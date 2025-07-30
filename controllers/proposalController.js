const Proposal = require("../models/Proposal");
const Student = require("../models/Student");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const Teacher = require("../models/Teacher"); 
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// Submit Proposal API
const submitProposal = async (req, res) => {
    try {
        const { projectTitle } = req.body;
        const groupId = req.user.groupID;

        // Basic validation
        if (!groupId || !projectTitle || !req.file) {
            return res.status(400).json({
                success: false,
                message: "Group ID, project title and PDF file are required"
            });
        }

        // Verify group leader
        const currentStudent = await Student.findById(req.user.id);
        if (!currentStudent || currentStudent.student_role !== "Group Leader") {
            return res.status(403).json({
                success: false,
                message: "Only Group Leader can submit the proposal"
            });
        }

        // Check existing proposal
        const existingProposal = await Proposal.findOne({ groupId });

        // Block if non-rejected proposal exists
        if (existingProposal && 
            existingProposal.status !== "Rejected" && 
            existingProposal.aiStatus !== "Fail" &&
            existingProposal.fypStatus !== "Rejected") {
            return res.status(409).json({
                success: false,
                message: "Proposal already submitted for this group"
            });
        }

        // Verify group members
        const students = await Student.find({ groupID: groupId });
        if (!students?.length) {
            return res.status(404).json({
                success: false,
                message: "No students found in this group"
            });
        }

        // Upload PDF to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { 
                    resource_type: "raw",
                    public_id: `proposal_${groupId}_${Date.now()}`
                },
                (error, result) => error ? reject(error) : resolve(result)
            );
            streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

        // Handle resubmission of rejected proposals
        if (existingProposal && 
            (existingProposal.status === "Rejected" || 
             existingProposal.aiStatus === "Fail" ||
             existingProposal.fypStatus === "Rejected")) {
            
            existingProposal.projectTitle = projectTitle;
            existingProposal.pdfUrl = uploadResult.secure_url;
            existingProposal.submittedAt = new Date();
            existingProposal.status = "Submitted";
            existingProposal.aiStatus = "Pending";
            existingProposal.fypStatus = "Pending";
            existingProposal.aiFeedback = null;
            existingProposal.fypFeedback = null;
            existingProposal.fypActionDate = null;
            existingProposal.aiReviewDate = null;
            
            await existingProposal.save();
            
            return res.status(200).json({
                success: true,
                message: "Proposal resubmitted successfully",
                data: existingProposal
            });
        }

        // Create new proposal
        const newProposal = new Proposal({
            groupId,
            groupMembers: students.map(s => s.rollNumber),
            projectTitle,
            pdfUrl: uploadResult.secure_url,
            submittedAt: new Date(),
            status: "Submitted",
            aiStatus: "Pending",
            fypStatus: "Pending",
            submittedBy: currentStudent._id
        });

        await newProposal.save();

        res.status(201).json({
            success: true,
            message: "Proposal submitted successfully",
            data: newProposal
        });

    } catch (error) {
        console.error("Submit Proposal Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Check Proposal Status API
const getProposalStatus = async (req, res) => {
    try {
        const groupId = req.user.groupID;

        const proposal = await Proposal.findOne({ groupId })
            .select('status projectTitle pdfUrl submittedAt aiStatus aiFeedback aiFeedbackDescription fypStatus fypFeedback fypActionDate submittedBy groupMembers assigned_teacher assigned_coadvisor')
            .populate('submittedBy', 'email name rollNumber')
            .populate('assigned_teacher', 'name email')
            .populate('assigned_coadvisor', 'name email')
            .lean();

        if (!proposal) {
            return res.status(200).json({
                exists: false,
                status: "Pending",
                message: "No proposal submitted yet"
            });
        }

        const isRejected = proposal.aiStatus === "Fail" || proposal.fypStatus === "Rejected";

        const displayStatus = proposal.fypStatus === "Approved" ? "Approved" :
                            isRejected ? "Pending" :
                            proposal.status;

        res.status(200).json({
            exists: true,
            status: displayStatus,
            projectTitle: isRejected ? "" : proposal.projectTitle,
            pdfUrl: isRejected ? "" : proposal.pdfUrl,
            submittedAt: proposal.submittedAt,
            aiStatus: proposal.aiStatus,
            aiFeedback: proposal.aiFeedback,
            aiFeedbackDescription: proposal.aiFeedbackDescription,
            fypStatus: proposal.fypStatus,
            fypFeedback: (proposal.fypStatus === "Approved" || proposal.fypStatus === "Rejected") 
            ? proposal.fypFeedback 
            : null,
            fypActionDate: proposal.fypActionDate,
            isRejected,
            submittedBy: proposal.submittedBy,
            groupMembers: proposal.groupMembers,
            assigned_teacher: proposal.assigned_teacher || null,
            assigned_coadvisor: proposal.assigned_coadvisor || null
        });

    } catch (error) {
        console.error("Status Check Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const getProposalByGroupId = async (req, res) => {
    try {
        const { groupId } = req.params;

        const proposal = await Proposal.findOne({ groupId })
            .populate("submittedBy", "name rollNumber")
            .populate("assigned_teacher", "name email")
            .populate("assigned_coadvisor", "name email")
            .lean();

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: "No proposal found for this group ID"
            });
        }

        res.status(200).json({
            success: true,
            data: proposal
        });

    } catch (error) {
        console.error("Get Proposal by Group ID Error:", error);
        res.status(500).json({
            success: false,
            message: `Internal server error: ${error.message}`
        });
    }
};

const aiReviewProposal = async (req, res) => {
    try {
        const { groupId } = req.params;

        const proposal = await Proposal.findOne({ groupId });
        if (!proposal) {
            return res.status(404).json({ success: false, message: "Proposal not found." });
        }

        // ✅ Strict check to allow only if AI hasn't reviewed it yet
        if (proposal.aiStatus !== "Pending") {
            return res.status(400).json({
                success: false,
                message: "AI review has already been completed for this proposal."
            });
        }

        // Step 1: Download proposal PDF
        const proposalPdf = await axios.get(proposal.pdfUrl, { responseType: "arraybuffer" });
        fs.writeFileSync("temp_proposal.pdf", proposalPdf.data);

        // Step 2: Load previous batch PDF from local path
        const previousFypPdfPath = path.join(__dirname, "../data/FYP LIST batch 2020S Final.pdf");
        if (!fs.existsSync(previousFypPdfPath)) {
            return res.status(500).json({ success: false, message: "Previous FYP PDF not found in /data." });
        }

        // Step 3: Load all teachers' expertise
        const teachers = await Teacher.find();
        const teacherExpertise = {};
        teachers.forEach(t => {
            teacherExpertise[t._id] = t.expertise;
        });

        // Step 4: Prepare form data
        const formData = new FormData();
        formData.append("proposal_pdf", fs.createReadStream("temp_proposal.pdf"));
        formData.append("previous_fyps_pdf", fs.createReadStream(previousFypPdfPath));
        formData.append("project_title", proposal.projectTitle);
        formData.append("teacher_expertise_json", JSON.stringify(teacherExpertise));

        // Step 5: Send request to Python AI API
        const aiResponse = await axios.post("http://127.0.0.1:8000/review-proposal", formData, {
            headers: formData.getHeaders(),
        });

        const { aiStatus, aiFeedback, aiFeedbackDescription, aiSuggestedSupervisor } = aiResponse.data;

        proposal.aiStatus = aiStatus;
        proposal.aiFeedback = aiFeedback;
        proposal.aiReviewDate = new Date();
        proposal.aiFeedbackDescription = aiFeedbackDescription;
        if (aiSuggestedSupervisor) {
            proposal.aiSuggestedSupervisor = aiSuggestedSupervisor;
        }

        await proposal.save();

        // Cleanup temp file
        fs.unlinkSync("temp_proposal.pdf");

        res.status(200).json({
            success: true,
            message: "AI review completed by Python NLP engine.",
            data: proposal
        });

    } catch (error) {
        console.error("AI Review Error:", error.message);
        return res.status(500).json({
            success: false,
            message: `Internal Server Error: ${error.message}`
        });
    }
};

const fypReviewProposal = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { fypStatus, fypFeedback, assigned_teacher, assigned_coadvisor } = req.body;

        if (!["Approved", "Rejected"].includes(fypStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid FYP status. Must be 'Approved' or 'Rejected'."
            });
        }

        const proposal = await Proposal.findOne({ groupId });

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: "Proposal not found for this group ID."
            });
        }

        proposal.fypStatus = fypStatus;
        proposal.fypFeedback = fypFeedback;
        proposal.fypActionDate = new Date();

        if (assigned_teacher) {
            const teacher = await Teacher.findById(assigned_teacher);
            if (!teacher) {
                return res.status(404).json({
                    success: false,
                    message: "Assigned teacher not found."
                });
            }
            proposal.assigned_teacher = teacher._id;
        }

        if (assigned_coadvisor) {
            const coAdvisor = await Teacher.findById(assigned_coadvisor);
            if (!coAdvisor) {
                return res.status(404).json({
                    success: false,
                    message: "Assigned co-advisor not found."
                });
            }
            proposal.assigned_coadvisor = coAdvisor._id;
        }

        await proposal.save();

        res.status(200).json({
            success: true,
            message: "FYP review submitted successfully",
            data: proposal
        });

    } catch (error) {
        console.error("FYP Review Proposal Error:", error);
        res.status(500).json({
            success: false,
            message: `Internal server error: ${error.message}`
        });
    }
};

const getAllProposals = async (req, res) => {
    try {
        const proposals = await Proposal.find()
            .populate("submittedBy", "email name registrationNo") // Added email
            .populate("aiSuggestedSupervisor", "name department email") // Added email
            .populate("assigned_teacher", "name department email") // Added email
            .populate("assigned_coadvisor", "name department email"); // Added email

        res.status(200).json({
            success: true,
            message: "All proposals fetched successfully",
            data: proposals
        });
    } catch (error) {
        console.error("Get All Proposals Error:", error);
        res.status(500).json({
            success: false,
            message: `Internal server error: ${error.message}`
        });
    }
};

const getAllAIReviewedProposals = async (req, res) => {
    try {
        const proposals = await Proposal.find({
            aiStatus: { $in: ["Pass", "Fail"] }
        })
            .populate("submittedBy", "email name registrationNo") // Added email
            .populate("aiSuggestedSupervisor", "name department email") // Added email
            .populate("assigned_teacher", "name department email") // Added email
            .populate("assigned_coadvisor", "name department email"); // Added email

        if (!proposals || proposals.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No AI-reviewed proposals found"
            });
        }

        res.status(200).json({
            success: true,
            message: "AI-reviewed proposals fetched successfully",
            data: proposals
        });
    } catch (error) {
        console.error("Get All AI Reviewed Proposals Error:", error);
        res.status(500).json({
            success: false,
            message: `Internal server error: ${error.message}`
        });
    }
};

const getApprovedProposals = async (req, res) => {
    try {
      const proposals = await Proposal.find({ fypStatus: 'Approved' })
        .populate('assigned_teacher', 'name teacherID email')
        .populate('assigned_coadvisor', 'name teacherID email');
  
      res.status(200).json(proposals);
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch proposals', error: err.message });
    }
  };
  

// Assign Supervisor
const assignSupervisor = async (req, res) => {
    const { proposalId, teacherId } = req.body;
  
    try {
      const teacher = await Teacher.findById(teacherId);
      if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
  
      // Check if teacher is already supervisor
      const alreadySupervisor = await Proposal.findOne({ assigned_teacher: teacherId });
      if (alreadySupervisor) {
        return res.status(400).json({ message: 'Teacher already assigned as Supervisor to another group' });
      }
  
      const proposal = await Proposal.findById(proposalId);
      if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
  
      // ✅ Block if proposal not approved by FYP Team
      if (proposal.fypStatus !== 'Approved') {
        return res.status(400).json({ message: 'Cannot assign supervisor. Proposal not approved by FYP Team yet.' });
      }
  
      if (proposal.assigned_teacher) {
        return res.status(400).json({ message: 'Supervisor already assigned to this group' });
      }
  
      // Assign supervisor to proposal
      proposal.assigned_teacher = teacherId;
      await proposal.save();
  
      // Update teacher record with group ID they are supervising
      teacher.isSupervisorOf = proposal.groupId;
      await teacher.save();
  
      res.status(200).json({ message: 'Supervisor assigned successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Failed to assign supervisor', error: err.message });
    }
  };  
  
  const assignCoAdvisor = async (req, res) => {
    const { proposalId, teacherId } = req.body;
  
    try {
      const proposal = await Proposal.findById(proposalId);
      if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
  
      if (proposal.fypStatus !== 'Approved') {
        return res.status(400).json({ message: 'Cannot assign co-advisor. Proposal not approved by FYP Team yet.' });
      }
  
      if (!proposal.assigned_teacher) {
        return res.status(400).json({ message: 'Assign a Supervisor before assigning a Co-Advisor' });
      }
  
      const teacher = await Teacher.findById(teacherId);
      if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
  
      // ✅ Updated co-advisor check
      if (teacher.isCoAdvisorOf) {
        return res.status(400).json({ message: 'Teacher is already assigned as Co-Advisor to another group' });
      }
  
      // Assign co-advisor to proposal
      proposal.assigned_coadvisor = teacherId;
      await proposal.save();
  
      // Update teacher record with group ID they are co-advising
      teacher.isCoAdvisorOf = proposal.groupId;
      await teacher.save();
  
      res.status(200).json({ message: 'Co-Advisor assigned successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Failed to assign co-advisor', error: err.message });
    }
  };  

  const getAvailableTeachers = async (req, res) => {
    const { role } = req.query;
  
    try {
      // Get all teachers with basic info
      const teachers = await Teacher.find().select('name teacherID email');
  
      if (role === 'supervisor') {
        // Get all teacher IDs already assigned as supervisors
        const assignedSupervisorIds = (await Proposal.distinct('assigned_teacher', { assigned_teacher: { $exists: true, $ne: null } }))
          .map(id => id.toString());
        
        // Filter out teachers who are already supervisors
        const availableTeachers = teachers.filter(teacher => 
          !assignedSupervisorIds.includes(teacher._id.toString())
        );
        return res.status(200).json(availableTeachers);
      }
  
      if (role === 'coadvisor') {
        // Get all teacher IDs already assigned as coadvisors
        const assignedCoadvisorIds = (await Proposal.distinct('assigned_coadvisor', { assigned_coadvisor: { $exists: true, $ne: null } }))
          .map(id => id.toString());
        
        // Filter out teachers who are already coadvisors
        const availableTeachers = teachers.filter(teacher => 
          !assignedCoadvisorIds.includes(teacher._id.toString())
        );
        return res.status(200).json(availableTeachers);
      }
  
      // If no specific role requested, return all teachers
      res.status(200).json(teachers);
    } catch (err) {
      res.status(500).json({ 
        message: 'Failed to fetch available teachers', 
        error: err.message 
      });
    }
  };

  //Remove Supervisor
  const removeSupervisor = async (req, res) => {
    try {
      const groupId = req.params.groupId;
      const proposal = await Proposal.findOne({ groupId });
  
      if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
      if (proposal.fypStatus !== 'Approved') return res.status(403).json({ message: 'Only proposals approved by FYP Team can be modified' });
      if (!proposal.assigned_teacher) return res.status(400).json({ message: 'No supervisor assigned to this group' });
  
      const teacher = await Teacher.findById(proposal.assigned_teacher);
      if (teacher) {
        teacher.isSupervisorOf = null;
        await teacher.save();
      }
  
      proposal.assigned_teacher = null;
      await proposal.save();
  
      res.status(200).json({ message: 'Supervisor removed successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error removing supervisor', error });
    }
  };
  
  
  // Remove Co-Advisor
  const removeCoAdvisor = async (req, res) => {
    try {
      const groupId = req.params.groupId;
      const proposal = await Proposal.findOne({ groupId });
  
      if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
      if (proposal.fypStatus !== 'Approved') return res.status(403).json({ message: 'Only proposals approved by FYP Team can be modified' });
      if (!proposal.assigned_coadvisor) return res.status(400).json({ message: 'No co-advisor assigned to this group' });
  
      const teacher = await Teacher.findById(proposal.assigned_coadvisor);
      if (teacher) {
        teacher.isCoAdvisorOf = null;
        await teacher.save();
      }
  
      proposal.assigned_coadvisor = null;
      await proposal.save();
  
      res.status(200).json({ message: 'Co-Advisor removed successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error removing co-advisor', error });
    }
  };  

  const aiReviewAllPendingProposals = async (req, res) => {
    try {
        const proposals = await Proposal.find({ aiStatus: "Pending" });
        if (!proposals.length) {
            return res.status(200).json({ success: true, message: "No pending proposals found." });
        }

        // Load static previous batch FYP list once
        const previousFypPdfPath = path.join(__dirname, "../data/FYP LIST batch 2020S Final.pdf");
        if (!fs.existsSync(previousFypPdfPath)) {
            return res.status(500).json({ success: false, message: "Previous FYP PDF not found in /data." });
        }

        // Load all teacher expertise once
        const teachers = await Teacher.find();
        const teacherExpertise = {};
        teachers.forEach(t => {
            teacherExpertise[t._id] = t.expertise;
        });

        const reviewedProposals = [];

        for (const proposal of proposals) {
            try {
                // Download proposal PDF from URL
                const proposalPdf = await axios.get(proposal.pdfUrl, { responseType: "arraybuffer" });
                const tempPath = `temp_${proposal.groupId}.pdf`;
                fs.writeFileSync(tempPath, proposalPdf.data);

                // Prepare form data for Python AI
                const formData = new FormData();
                formData.append("proposal_pdf", fs.createReadStream(tempPath));
                formData.append("previous_fyps_pdf", fs.createReadStream(previousFypPdfPath));
                formData.append("project_title", proposal.projectTitle);
                formData.append("teacher_expertise_json", JSON.stringify(teacherExpertise));

                const aiResponse = await axios.post("https://fyp-ai-review-proposals.onrender.com/", formData, {
                    headers: formData.getHeaders(),
                    timeout: 60000,
                });

                const { aiStatus, aiFeedback, aiFeedbackDescription, aiSuggestedSupervisor } = aiResponse.data;

                // Update proposal document
                proposal.aiStatus = aiStatus;
                proposal.aiFeedback = aiFeedback;
                proposal.aiFeedbackDescription = aiFeedbackDescription;
                proposal.aiReviewDate = new Date();
                if (aiSuggestedSupervisor) {
                    proposal.aiSuggestedSupervisor = aiSuggestedSupervisor;
                }

                await proposal.save();
                fs.unlinkSync(tempPath);

                reviewedProposals.push(proposal);

            } catch (innerErr) {
                console.error(`❌ Failed for Group ${proposal.groupId}:`, innerErr.message);
                reviewedProposals.push({
                    groupId: proposal.groupId,
                    error: innerErr.message
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `AI review completed for ${reviewedProposals.length} proposal(s).`,
            data: reviewedProposals
        });

    } catch (error) {
        console.error("Bulk AI Review Error:", error.message);
        return res.status(500).json({
            success: false,
            message: `Internal Server Error: ${error.message}`
        });
    }
};
  
module.exports = { 
    submitProposal,  
    getProposalStatus, 
    getProposalByGroupId, 
    aiReviewProposal, 
    fypReviewProposal, 
    getAllProposals, 
    getAllAIReviewedProposals, 
    getApprovedProposals, 
    assignSupervisor, 
    assignCoAdvisor,
    getAvailableTeachers,
    removeSupervisor,
    removeCoAdvisor,
    aiReviewAllPendingProposals
};