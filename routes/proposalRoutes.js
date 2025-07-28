const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/proposalController");

const { verifyToken, verifyFYPTeam } = require("../middleware/authMiddleware");
const upload = require("../config/multer");

router.post("/submit", verifyToken, upload.single("pdf"), submitProposal);
router.get("/status", verifyToken, getProposalStatus);
router.get("/by-group/:groupId", verifyFYPTeam, getProposalByGroupId);
router.put("/ai-review/:groupId", verifyFYPTeam, aiReviewProposal);
router.put("/ai-review-bulk", verifyFYPTeam, aiReviewAllPendingProposals);
router.put("/fyp-review/:groupId", verifyFYPTeam, fypReviewProposal);
router.get("/all", verifyFYPTeam, getAllProposals);
router.get("/ai-reviewed", verifyFYPTeam, getAllAIReviewedProposals); 
router.get('/approved-proposals', verifyToken, verifyFYPTeam, getApprovedProposals);
router.post('/assign-supervisor', verifyToken, verifyFYPTeam, assignSupervisor);
router.post('/assign-coadvisor', verifyToken, verifyFYPTeam, assignCoAdvisor);
router.get('/available-teachers', verifyToken, verifyFYPTeam, getAvailableTeachers);
router.delete('/remove-supervisor/:groupId', verifyToken, verifyFYPTeam, removeSupervisor);
router.delete('/remove-coadvisor/:groupId', verifyToken, verifyFYPTeam, removeCoAdvisor);

module.exports = router;