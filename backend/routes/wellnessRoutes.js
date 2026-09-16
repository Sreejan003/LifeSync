const express = require('express');
const router = express.Router();
const wellnessController = require('../controllers/wellnessController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/summary', wellnessController.getWellnessSummary);
router.get('/', wellnessController.getWellnessRecords);
router.get('/:id', wellnessController.getWellnessById);
router.post('/', wellnessController.createWellnessRecord);
router.delete('/:id', wellnessController.deleteWellnessRecord);

module.exports = router;
