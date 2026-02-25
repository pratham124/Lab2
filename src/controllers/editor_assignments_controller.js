const { createAssignmentController } = require("./assignment_controller");

function createEditorAssignmentsController(dependencies = {}) {
  return createAssignmentController(dependencies);
}

module.exports = {
  createEditorAssignmentsController,
};
