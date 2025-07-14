const express = require('express');
const router = express.Router();
const { ensureGuest } = require('../middleware/auth');

// @desc    Login/Landing page
// @route   GET /
router.get('/', ensureGuest, (req, res) => {
  res.render('login');
});

module.exports = router;
