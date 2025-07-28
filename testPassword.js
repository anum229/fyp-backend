const bcrypt = require('bcryptjs');

const enteredPassword = "123456"; // The password you're logging in with
const hashedPassword = "$2b$10$wKf6vGtpQrbKxX5VzJUwy.AgKfptE22pGWJDouEkJAFqajoo3yJqC"; // Hashed password from MongoDB

bcrypt.compare(enteredPassword, hashedPassword)
    .then(isMatch => {
        console.log("Password Match:", isMatch);
    })
    .catch(err => console.error("Error:", err));
