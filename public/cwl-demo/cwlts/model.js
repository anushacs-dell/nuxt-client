// Adapted version of cwlts/models for recent Node.js modules
// Simplified to work with cwl-svg

/**
 * Base class for all CWL models
 */
class CWLModel {
    constructor(data = {}) {
        this.id = data.id || '';
        this.label = data.label || '';
        this.doc = data.doc || '';
        this.cwlVersion = data.cwlVersion || 'v1.0';
    }

    serialize() {
        return JSON.stringify(this);
    }
}

/**
 * Model for CWL workflows
 */
class WorkflowModel extends CWLModel {
    constructor(data = {}) {
        super(data);
        this.class = 'Workflow';
        this.inputs = data.inputs || [];
        this.outputs = data.outputs || [];
        this.steps = data.steps || [];
        this.requirements = data.requirements || [];
        this.hints = data.hints || [];
    }

    addStep(step) {
        this.steps.push(step);
    }

    getStep(id) {
        return this.steps.find(step => step.id === id);
    }
}

/**
 * Model for workflow steps
 */
class WorkflowStepModel extends CWLModel {
    constructor(data = {}) {
        super(data);
        this.run = data.run || '';
        this.in = data.in || [];
        this.out = data.out || [];
        this.scatter = data.scatter || null;
        this.when = data.when || null;
    }
}

/**
 * Model for command line tools
 */
class CommandLineToolModel extends CWLModel {
    constructor(data = {}) {
        super(data);
        this.class = 'CommandLineTool';
        this.baseCommand = data.baseCommand || [];
        this.arguments = data.arguments || [];
        this.inputs = data.inputs || [];
        this.outputs = data.outputs || [];
        this.requirements = data.requirements || [];
        this.hints = data.hints || [];
    }
}

/**
 * Model for input parameters
 */
class WorkflowInputParameterModel extends CWLModel {
    constructor(data = {}) {
        super(data);
        this.type = data.type || 'string';
        this.default = data.default || null;
        this.format = data.format || null;
        this.streamable = data.streamable || false;
    }
}

/**
 * Model for output parameters
 */
class WorkflowOutputParameterModel extends CWLModel {
    constructor(data = {}) {
        super(data);
        this.type = data.type || 'string';
        this.outputSource = data.outputSource || null;
        this.linkMerge = data.linkMerge || null;
        this.format = data.format || null;
    }
}

/**
 * Model for step inputs
 */
class WorkflowStepInputModel extends CWLModel {
    constructor(data = {}) {
        super(data);
        this.source = data.source || null;
        this.linkMerge = data.linkMerge || null;
        this.default = data.default || null;
        this.valueFrom = data.valueFrom || null;
    }
}

/**
 * Model for step outputs
 */
class WorkflowStepOutputModel extends CWLModel {
    constructor(data = {}) {
        super(data);
        this.id = data.id || '';
    }
}

/**
 * Model for tool inputs
 */
class CommandInputParameterModel extends CWLModel {
    constructor(data = {}) {
        super(data);
        this.type = data.type || 'string';
        this.inputBinding = data.inputBinding || null;
        this.default = data.default || null;
        this.format = data.format || null;
    }
}

/**
 * Model for tool outputs
 */
class CommandOutputParameterModel extends CWLModel {
    constructor(data = {}) {
        super(data);
        this.type = data.type || 'string';
        this.outputBinding = data.outputBinding || null;
        this.format = data.format || null;
    }
}

/**
 * Utility class to create models from CWL data
 */
class ModelFactory {
    static createModel(data) {
        if (!data || typeof data !== 'object') {
            return null;
        }

        switch (data.class) {
            case 'Workflow':
                return new WorkflowModel(data);
            case 'CommandLineTool':
                return new CommandLineToolModel(data);
            default:
                return new CWLModel(data);
        }
    }

    static createWorkflow(data) {
        return new WorkflowModel(data);
    }

    static createCommandLineTool(data) {
        return new CommandLineToolModel(data);
    }
}

// Exportation ES6 pour webpack
export {
    CWLModel,
    WorkflowModel,
    WorkflowStepModel,
    CommandLineToolModel,
    WorkflowInputParameterModel,
    WorkflowOutputParameterModel,
    WorkflowStepInputModel,
    WorkflowStepOutputModel,
    CommandInputParameterModel,
    CommandOutputParameterModel,
    ModelFactory
};

export default ModelFactory;