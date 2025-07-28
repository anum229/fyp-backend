const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: 'dpz8cukhi',  // your cloud name
    api_key: '623118558843698',  // your api key
    api_secret: 'ZHg3FUIeNaMrwoWSEaYrqusy_Wc'  // your api secret
});

module.exports = cloudinary;