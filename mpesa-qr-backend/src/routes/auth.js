const express = require("express");
const { 
  signUp, 
  login, 
  fixIncompleteRegistration, 
  cleanupIncompleteUser, 
  checkUserStatus,
  diagnoseProblem,
  fixAllIncompleteUsers
} = require("../controllers/auth");
const { verifyToken } = require("../middlewares/auth");

const router = express.Router();

// Registration and login routes
router.post("/signup", signUp);
router.post("/login", login);

// Token verification route
router.post("/verify-token", verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Token is valid",
    user: req.user
  });
});

// Problem-solving routes
router.post("/fix-registration", fixIncompleteRegistration);
router.post("/cleanup-user", cleanupIncompleteUser);
router.post("/check-status", checkUserStatus);
router.post("/diagnose-problem", diagnoseProblem);
router.post("/fix-all-incomplete", fixAllIncompleteUsers);

module.exports = router;