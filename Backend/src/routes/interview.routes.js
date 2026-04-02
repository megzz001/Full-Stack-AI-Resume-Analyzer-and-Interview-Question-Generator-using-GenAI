const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const interviewController = require('../controllers/interview.controller');
const upload = require('../middlewares/file.middleware');


const interviewRouter = express.Router();
/**
 * @route POST /api/interview/generate
 * @description Generate interview report in strict JSON format
 * @access Private
 */
interviewRouter.post('/', authMiddleware.authUser ,upload.single("resume"), interviewController.generateInterviewReportController);

/**
 * @route GET /api/interview/report/:interviewId
 * @description Get interview report by interviewId
 * @access Private
 */
interviewRouter.get('/report/:interviewId', authMiddleware.authUser, interviewController.getInterviewReportByIdController);

/**
 * @route GET /api/interview/
 * @description Get all interview reports of logged in user
 * @access Private
 */

interviewRouter.get('/', authMiddleware.authUser, interviewController.getAllInterviewReportsController);

/**
 * @route DELETE /api/interview/:interviewId
 * @description Delete interview report by interviewId
 * @access Private
 */
interviewRouter.delete('/:interviewId', authMiddleware.authUser, interviewController.deleteInterviewReportController);

/**
 * @route GET/api/interview/pdf
 * @description generate resume pdf on the basis of user self description , resume and job description 
 * @access private
 */
interviewRouter.post("/resume/pdf/:interviewReportId", authMiddleware.authUser, interviewController.generateResumePdfController)

module.exports = interviewRouter;
