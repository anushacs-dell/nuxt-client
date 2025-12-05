/**
 * CWL-SVG Custom - Custom version for CWL visualizer
 * Features: CWL parsing, SVG rendering, user interactions
 */

class CWLSVGCustom {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.options = {
            width: options.width || 900,
            height: options.height || 600,
            nodeWidth: options.nodeWidth || 140,
            nodeHeight: options.nodeHeight || 70,
            nodeSpacing: options.nodeSpacing || 80,
            levelSpacing: options.levelSpacing || 180,
            ...options
        };
        
        this.workflow = null;
        this.svg = null;
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;
        this.draggedNode = null;
        this.selectedNodes = new Set();
        
        // Public API
        this._api = null;
        
        this.initializeSVG();
        this.setupEventHandlers();
    }
    
    /**
     * Get the public API instance
     * @returns {CWLVisualizerAPI}
     */
    api() {
        if (!this._api) {
            this._api = new CWLVisualizerAPI(this);
        }
        return this._api;
    }
    
    /**
     * Initialize the main SVG element
     */
    initializeSVG() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create wrapper with controls
        const wrapper = document.createElement('div');
        wrapper.className = 'cwl-svg-wrapper';
        wrapper.style.cssText = `
            position: relative;
            width: 100%;
            height: ${this.options.height}px;
            border: 1px solid #333;
            border-radius: 8px;
            overflow: hidden;
            background: #303030;
        `;
        
        // Create controls
        const controls = document.createElement('div');
        controls.className = 'cwl-svg-controls';
        controls.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 100;
            display: flex;
            gap: 5px;
        `;
        
        const createButton = (text, onclick, title = '') => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.title = title;
            btn.style.cssText = `
                padding: 5px 10px;
                background: #4f46e5;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;
            btn.onclick = onclick;
            return btn;
        };
        
        controls.appendChild(createButton('🔍+', () => this.zoom(1.2), 'Zoom in'));
        controls.appendChild(createButton('🔍−', () => this.zoom(0.8), 'Zoom out'));
        controls.appendChild(createButton('🔄', () => this.resetView(), 'Reset view'));
        controls.appendChild(createButton('�', () => this.autoLayout(), 'Auto-arrange'));
        controls.appendChild(createButton('�💾', () => this.downloadSVG(), 'Download SVG'));
        
        // Create SVG element
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.setAttribute('viewBox', `0 0 ${this.options.width} ${this.options.height}`);
        this.svg.style.cursor = 'grab';
        
        // Groupe principal pour les transformations
        this.mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.mainGroup.setAttribute('class', 'main-group');
        this.svg.appendChild(this.mainGroup);
        
        // Definitions for vue-cwl styles
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <style>
                .cwl-node { 
                    cursor: move; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .cwl-node:hover { 
                    transform: translateY(-1px);
                    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.15));
                }
                .cwl-node.selected rect { 
                    stroke: #6366f1 !important; 
                    stroke-width: 3 !important; 
                    filter: drop-shadow(0 0 12px rgba(99, 102, 241, 0.5));
                }
                .cwl-connection { 
                    pointer-events: none;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .cwl-connection.highlighted { 
                    stroke: #f59e0b !important; 
                    stroke-width: 4 !important; 
                    filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.6));
                    animation: pulse 2s infinite;
                }
                .cwl-connection.dimmed { 
                    opacity: 0.3;
                    stroke-width: 1.5;
                }
                .cwl-text { 
                    pointer-events: none; 
                    user-select: none; 
                }
                .cwl-node.dragging {
                    filter: drop-shadow(0 8px 25px rgba(0, 0, 0, 0.3));
                    transform: scale(1.02);
                }
                /* Styles authentiques cwl-svg par rabix */
                .node {
                    cursor: move;
                    outline: none;
                }
                
                .node .outer {
                    fill: white;
                    stroke: rgb(154, 154, 154);
                    stroke-width: 2px;
                }
                
                .node .inner {
                    stroke: 0;
                }
                
                .node.input .inner {
                    fill: #c3c3c3;
                }
                
                .node.output .inner {
                    fill: #c3c3c3;
                }
                
                .node.step .inner {
                    fill: #11a7a7;
                }
                
                .node-icon {
                    fill: #333;
                    stroke: #333;
                    stroke-width: 3px;
                }
                
                .label {
                    fill: #333;
                    stroke: white;
                    stroke-width: 4px;
                    text-anchor: middle;
                    paint-order: stroke;
                    stroke-linecap: butt;
                    stroke-linejoin: miter;
                    font-family: sans-serif;
                    font-size: 14px;
                }
                
                .port {
                    fill: rgb(154, 154, 154);
                }
                
                .port:hover {
                    stroke: rgb(123, 123, 123);
                    stroke-width: 2px;
                }
                
                .port.output-port .label {
                    text-anchor: start;
                    transform: translate(10px, 0);
                }
                
                .port.input-port .label {
                    text-anchor: end;
                    transform: translate(-10px, 0);
                }
                
                .port .label {
                    fill: #333;
                    opacity: 0;
                    font-size: .9em;
                    user-select: none;
                    transition: all .1s;
                    pointer-events: none;
                    alignment-baseline: middle;
                }
                
                .node:hover .outer {
                    stroke: #11a7a7;
                    stroke-width: 3px;
                    filter: drop-shadow(0 0 8px rgba(17, 167, 167, 0.4));
                }
                
                /* Styles authentiques cwl-svg pour les edges */
                .edge {
                    outline: none;
                    cursor: pointer;
                }
                
                .edge .sub-edge.outer {
                    stroke: #222;
                    stroke-width: 4px;
                    fill: none;
                    pointer-events: stroke;
                }
                
                .edge .sub-edge.inner {
                    stroke: #ffffff;
                    stroke-width: 2px;
                    fill: none;
                    pointer-events: none;
                }
                
                .edge:hover .sub-edge.outer {
                    stroke: #11a7a7;
                    stroke-width: 5px;
                }
                
                .edge:hover .sub-edge.inner {
                    stroke: #ffffff;
                    stroke-width: 3px;
                }
                
                .edge.highlighted .sub-edge.outer {
                    stroke: #11a7a7;
                    stroke-width: 5px;
                    filter: drop-shadow(0 0 8px rgba(17, 167, 167, 0.6));
                }
                
                .edge.highlighted .sub-edge.inner {
                    stroke: #ffffff;
                    stroke-width: 3px;
                }
                
                .workflow {
                    user-select: none;
                }
                
                .cwl-port {
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .cwl-port:hover {
                    stroke-width: 3;
                    filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.5));
                }
                .port-label {
                    pointer-events: none;
                }
                .port-details-panel {
                    pointer-events: auto;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            </style>

            <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        `;
        this.svg.appendChild(defs);
        
        wrapper.appendChild(this.svg);
        wrapper.appendChild(controls);
        this.container.appendChild(wrapper);
    }
    
    /**
     * Configure event handlers
     */
    setupEventHandlers() {
        let isPanning = false;
        let startPoint = { x: 0, y: 0 };
        let startPan = { x: 0, y: 0 };
        
        // Zoom avec la molette
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom(delta);
        });
        
        // Pan avec clic-glisser
        this.svg.addEventListener('mousedown', (e) => {
            if (e.target === this.svg || e.target === this.mainGroup) {
                isPanning = true;
                startPoint = { x: e.clientX, y: e.clientY };
                startPan = { x: this.panX, y: this.panY };
                this.svg.style.cursor = 'grabbing';
                // Close port details when clicking on background
                this.clearPortDetails();
            }
        });
        
        this.svg.addEventListener('mousemove', (e) => {
            if (isPanning) {
                const dx = e.clientX - startPoint.x;
                const dy = e.clientY - startPoint.y;
                this.panX = startPan.x + dx;
                this.panY = startPan.y + dy;
                this.updateTransform();
            }
        });
        
        this.svg.addEventListener('mouseup', () => {
            isPanning = false;
            this.svg.style.cursor = 'grab';
        });
        
        this.svg.addEventListener('mouseleave', () => {
            isPanning = false;
            this.svg.style.cursor = 'grab';
        });
    }
    
    /**
     * Parse a CWL workflow from a JSON/YAML string
     */
    async loadWorkflow(cwlContent, format = 'auto') {
        try {
            let workflowData;
            
            if (format === 'auto') {
                // Detect format
                const trimmed = cwlContent.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    format = 'json';
                } else {
                    format = 'yaml';
                }
            }
            
            if (format === 'yaml') {
                if (typeof jsyaml === 'undefined') {
                    throw new Error('js-yaml library not loaded');
                }
                workflowData = jsyaml.load(cwlContent);
            } else {
                workflowData = JSON.parse(cwlContent);
            }
            
                console.log('🔍 Parsed CWL data:', workflowData);
            this.workflow = this.processWorkflow(workflowData);
            console.log('🔍 Workflow after processing:', this.workflow);
            console.log('🔍 Inputs:', Object.keys(this.workflow.inputs));
            console.log('🔍 Steps:', Object.keys(this.workflow.steps));  
            console.log('🔍 Outputs:', Object.keys(this.workflow.outputs));
            this.render();
            
            return { success: true, workflow: this.workflow };
        } catch (error) {
            console.error('Error parsing CWL:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Process and structure workflow data
     */
    processWorkflow(data) {
        // If it's a file with $graph, extract the main workflow
        if (data.$graph) {
            return this.processGraphWorkflow(data);
        }
        
        // Si c'est un CommandLineTool, le convertir en workflow simple
        if (data.class === 'CommandLineTool') {
            return this.processCommandLineTool(data);
        }
        
        const workflow = {
            class: data.class || 'Workflow',
            id: data.id || 'workflow',
            label: data.label || data.id || 'Workflow',
            inputs: {},
            outputs: {},
            steps: {},
            connections: []
        };
        
        // Traiter les inputs
        if (data.inputs) {
            if (Array.isArray(data.inputs)) {
                data.inputs.forEach((input, idx) => {
                    const id = input.id || `input_${idx}`;
                    workflow.inputs[id] = {
                        id,
                        type: input.type || 'any',
                        label: input.label || id,
                        doc: input.doc || ''
                    };
                });
            } else {
                Object.entries(data.inputs).forEach(([id, input]) => {
                    workflow.inputs[id] = {
                        id,
                        type: input.type || input || 'any',
                        label: input.label || id,
                        doc: input.doc || ''
                    };
                });
            }
        }
        
        // Traiter les outputs
        if (data.outputs) {
            if (Array.isArray(data.outputs)) {
                data.outputs.forEach((output, idx) => {
                    const id = output.id || `output_${idx}`;
                    workflow.outputs[id] = {
                        id,
                        type: output.type || 'any',
                        label: output.label || id,
                        outputSource: output.outputSource
                    };
                });
            } else {
                Object.entries(data.outputs).forEach(([id, output]) => {
                    workflow.outputs[id] = {
                        id,
                        type: output.type || output || 'any',
                        label: output.label || id,
                        outputSource: output.outputSource
                    };
                });
            }
        }
        
    // Process steps
    console.log('🔍 Processing steps. data.steps:', data.steps);
        if (data.steps) {
            if (Array.isArray(data.steps)) {
        console.log('🔍 Steps in array format');
                data.steps.forEach((step, idx) => {
                    const id = step.id || `step_${idx}`;
                    workflow.steps[id] = {
                        id,
                        label: step.label || id,
                        run: step.run,
                        in: step.in || {},
                        out: step.out || []
                    };
                    console.log(`🔍 Step added: ${id}`, workflow.steps[id]);
                });
            } else {
                console.log('🔍 Steps in object format');
                Object.entries(data.steps).forEach(([id, step]) => {
                    workflow.steps[id] = {
                        id,
                        label: step.label || id,
                        run: step.run,
                        in: step.in || {},
                        out: step.out || []
                    };
                    console.log(`🔍 Step added: ${id}`, workflow.steps[id]);
                });
            }
        }
        
    // Analyze connections
        this.analyzeConnections(workflow);
        
        return workflow;
    }

    /**
     * Convertit un CommandLineTool en workflow simple visualisable
     */
    processCommandLineTool(data) {
    console.log('🔧 Processing CommandLineTool:', data);
        
        const toolId = data.id || 'tool';
        const toolLabel = data.label || (Array.isArray(data.baseCommand) ? data.baseCommand.join(' ') : data.baseCommand) || toolId;
        
        const workflow = {
            class: 'Workflow',
            id: 'workflow_' + toolId,
            label: `Workflow: ${toolLabel}`,
            inputs: {},
            outputs: {},
            steps: {},
            connections: []
        };

        // Traiter les inputs du tool
        if (data.inputs) {
            Object.entries(data.inputs).forEach(([inputId, inputDef]) => {
                workflow.inputs[inputId] = {
                    id: inputId,
                    label: inputDef.label || inputId,
                    type: inputDef.type || 'Any',
                    doc: inputDef.doc
                };
            });
        }

        // Traiter les outputs du tool
        if (data.outputs) {
            Object.entries(data.outputs).forEach(([outputId, outputDef]) => {
                workflow.outputs[outputId] = {
                    id: outputId,
                    label: outputDef.label || outputId,
                    type: outputDef.type || 'Any',
                    outputSource: `${toolId}/${outputId}`
                };
            });
        }

        // Create single step representing the tool
        workflow.steps[toolId] = {
            id: toolId,
            label: toolLabel,
            run: Array.isArray(data.baseCommand) ? data.baseCommand.join(' ') : data.baseCommand || 'tool',
            in: {},
            out: []
        };

        // Connect all inputs to the step
        Object.keys(workflow.inputs).forEach(inputId => {
            workflow.steps[toolId].in[inputId] = inputId;
            
            // Create connection input -> step
            workflow.connections.push({
                from: { id: inputId, type: 'input', port: 'output' },
                to: { id: toolId, type: 'step', port: inputId }
            });
        });

        // Add outputs to the step
        Object.keys(workflow.outputs).forEach(outputId => {
            workflow.steps[toolId].out.push(outputId);
            
            // Create connection step -> output
            workflow.connections.push({
                from: { id: toolId, type: 'step', port: outputId },
                to: { id: outputId, type: 'output', port: 'input' }
            });
        });

        console.log('🔧 CommandLineTool converted to workflow:', workflow);
        return workflow;
    }

    /**
     * Process CWL files with $graph (containing multiple components)
     */
    processGraphWorkflow(data) {
        console.log('📊 Processing $graph file:', data);
        
        if (!data.$graph || !Array.isArray(data.$graph)) {
            throw new Error('Invalid $graph format');
        }

        // Find main workflow in the graph
        let mainWorkflow = data.$graph.find(item => item.class === 'Workflow');
        
        if (!mainWorkflow) {
            throw new Error('No workflow found in $graph');
        }

        console.log('📊 Main workflow found:', mainWorkflow);

        // Process main workflow normally
        const workflow = {
            class: mainWorkflow.class,
            id: mainWorkflow.id || 'workflow',
            label: mainWorkflow.label || mainWorkflow.id || 'Workflow',
            inputs: {},
            outputs: {},
            steps: {},
            connections: []
        };

        // Traiter les inputs
        if (mainWorkflow.inputs) {
            Object.entries(mainWorkflow.inputs).forEach(([inputId, inputDef]) => {
                workflow.inputs[inputId] = {
                    id: inputId,
                    label: inputDef.label || inputId,
                    type: inputDef.type || 'Any',
                    doc: inputDef.doc
                };
            });
        }

        // Traiter les outputs
        if (mainWorkflow.outputs) {
            Object.entries(mainWorkflow.outputs).forEach(([outputId, outputDef]) => {
                workflow.outputs[outputId] = {
                    id: outputId,
                    label: outputDef.label || outputId,
                    type: outputDef.type || 'Any',
                    outputSource: outputDef.outputSource
                };
            });
        }

        // Traiter les steps
        if (mainWorkflow.steps) {
            Object.entries(mainWorkflow.steps).forEach(([stepId, stepDef]) => {
                workflow.steps[stepId] = {
                    id: stepId,
                    label: stepDef.label || stepId,
                    run: stepDef.run,
                    in: stepDef.in || {},
                    out: stepDef.out || []
                };
                console.log(`🔍 Step added: ${stepId}`, workflow.steps[stepId]);
            });
        }

        // Analyze connections
        this.analyzeConnections(workflow);
        
        console.log('📊 $graph workflow processed:', workflow);
        return workflow;
    }
    
    /**
     * Analyse les connexions entre les éléments
     */
    analyzeConnections(workflow) {
        // Connexions des inputs vers les steps
        Object.values(workflow.steps).forEach(step => {
            if (step.in) {
                Object.entries(step.in).forEach(([inputId, source]) => {
                    let sourceId, sourcePort;
                    
                    if (typeof source === 'string') {
                        sourceId = source;
                        sourcePort = 'output';
                    } else if (source.source) {
                        sourceId = source.source;
                        sourcePort = 'output';
                    } else {
                        return;
                    }
                    
                    // Determine source type
                    if (workflow.inputs[sourceId]) {
                        workflow.connections.push({
                            from: { id: sourceId, type: 'input', port: sourcePort },
                            to: { id: step.id, type: 'step', port: inputId }
                        });
                    } else {
                        // Chercher dans les outputs des autres steps
                        Object.values(workflow.steps).forEach(otherStep => {
                            if (otherStep.id !== step.id && 
                                typeof sourceId === 'string' &&
                                (sourceId.startsWith(otherStep.id + '/') || sourceId === otherStep.id)) {
                                
                                // Extraire le nom du port depuis step1/processed_file
                                let fromPortName = sourcePort;
                                if (sourceId.includes('/')) {
                                    fromPortName = sourceId.split('/')[1];
                                }
                                
                                workflow.connections.push({
                                    from: { id: otherStep.id, type: 'step', port: fromPortName },
                                    to: { id: step.id, type: 'step', port: inputId }
                                });
                            }
                        });
                    }
                });
            }
        });
        
        // Connections from steps to outputs
        Object.values(workflow.outputs).forEach(output => {
            if (output.outputSource) {
                // outputSource can be a string or an array
                let sourceSources = Array.isArray(output.outputSource) ? output.outputSource : [output.outputSource];
                
                sourceSources.forEach(sourceId => {
                    Object.values(workflow.steps).forEach(step => {
                        if (typeof sourceId === 'string' && 
                            (sourceId.startsWith(step.id + '/') || sourceId === step.id)) {
                            
                            // Extraire le nom du port depuis step_1/output_directory
                            let fromPortName = 'output';
                            if (sourceId.includes('/')) {
                                fromPortName = sourceId.split('/')[1];
                            }
                            
                            workflow.connections.push({
                                from: { id: step.id, type: 'step', port: fromPortName },
                                to: { id: output.id, type: 'output', port: 'input' }
                            });
                        }
                    });
                });
            }
        });
    }
    
    /**
     * Calcule le layout automatique des éléments avec organisation gauche-droite
     */
    calculateLayout() {
        const layout = { nodes: {}, levels: [] };
        const { nodeWidth, nodeHeight, nodeSpacing, levelSpacing } = this.options;
        
        // Topological analysis for left-right arrangement
        const levels = this.calculateTopologicalLevels();
        console.log('🔍 Levels calculated:', levels);
        
        let currentX = 50;
        
        levels.forEach((level, levelIndex) => {
            console.log(`🔍 Traitement niveau ${levelIndex}:`, level);
            const levelHeight = level.length * nodeHeight + (level.length - 1) * nodeSpacing;
            let startY = Math.max(50, (this.options.height - levelHeight) / 2);
            
            level.forEach((id, index) => {
                const x = currentX;
                const y = startY + index * (nodeHeight + nodeSpacing);
                
                console.log(`🔍 Position calculée pour ${id}: x=${x}, y=${y}`);
                layout.nodes[id] = { x, y, width: nodeWidth, height: nodeHeight };
            });
            
            currentX += nodeWidth + levelSpacing;
        });
        
        return layout;
    }

    /**
     * Calcule les niveaux topologiques avec gestion spéciale des workflows simples
     */
    calculateTopologicalLevels() {
        const inputIds = Object.keys(this.workflow.inputs);
        const stepIds = Object.keys(this.workflow.steps);
        const outputIds = Object.keys(this.workflow.outputs);
        
        console.log('🔍 Checking simple workflow - stepIds.length:', stepIds.length);
        // Special case: simple workflow with single step
        if (stepIds.length <= 1) {
            console.log('🔍 Using calculateSimpleWorkflowLevels');
            return this.calculateSimpleWorkflowLevels(inputIds, stepIds, outputIds);
        }
        
        // Workflow complexe : tri topologique standard
        const levels = [];
        const processed = new Set();
        const inDegree = new Map();
        
        const allNodes = [
            ...inputIds.map(id => ({ id, type: 'input' })),
            ...stepIds.map(id => ({ id, type: 'step' })),
            ...outputIds.map(id => ({ id, type: 'output' }))
        ];
        
        allNodes.forEach(node => inDegree.set(node.id, 0));
        
        // Calculate incoming degrees
        this.workflow.connections.forEach(conn => {
            const current = inDegree.get(conn.to.id) || 0;
            inDegree.set(conn.to.id, current + 1);
        });
        
        // Topological sort by levels
        while (processed.size < allNodes.length) {
            const currentLevel = [];
            
            // Find nodes without unprocessed dependencies
            allNodes.forEach(node => {
                if (!processed.has(node.id) && (inDegree.get(node.id) === 0)) {
                    currentLevel.push(node.id);
                }
            });
            
            if (currentLevel.length === 0) {
                // Avoid loops - add remaining nodes
                allNodes.forEach(node => {
                    if (!processed.has(node.id)) {
                        currentLevel.push(node.id);
                    }
                });
            }
            
            // Organiser par type (inputs -> steps -> outputs)
            currentLevel.sort((a, b) => {
                const typeOrder = { input: 0, step: 1, output: 2 };
                const typeA = this.getNodeType(a);
                const typeB = this.getNodeType(b);
                return typeOrder[typeA] - typeOrder[typeB];
            });
            
            levels.push(currentLevel);
            
            // Mark as processed
            currentLevel.forEach(nodeId => {
                processed.add(nodeId);
                
                // Reduce degree of connected nodes
                this.workflow.connections.forEach(conn => {
                    if (conn.from.id === nodeId) {
                        const current = inDegree.get(conn.to.id);
                        inDegree.set(conn.to.id, Math.max(0, current - 1));
                    }
                });
            });
        }
        
        return levels;
    }

    /**
     * Calculate layout for a simple workflow (single step)
     */
    calculateSimpleWorkflowLevels(inputIds, stepIds, outputIds) {
        console.log('🔍 calculateSimpleWorkflowLevels called with:', {inputIds, stepIds, outputIds});
        const levels = [];
        
        // Level 1: Inputs (always on left)
        if (inputIds.length > 0) {
            console.log('🔍 Adding inputs level:', inputIds);
            levels.push(inputIds);
        }
        
        // Level 2: Step(s) (in center)
        if (stepIds.length > 0) {
            console.log('🔍 Adding steps level:', stepIds);
            levels.push(stepIds);
        }
        
        // Level 3: Outputs (always on right)
        if (outputIds.length > 0) {
            console.log('🔍 Adding outputs level:', outputIds);
            levels.push(outputIds);
        }
        
        console.log('🔍 Levels returned:', levels);
        return levels;
    }

    /**
     * Détermine le type d'un noeud
     */
    getNodeType(nodeId) {
        if (this.workflow.inputs[nodeId]) return 'input';
        if (this.workflow.outputs[nodeId]) return 'output';
        return 'step';
    }

    /**
     * Crée les ports d'entrée/sortie avec métadonnées CWL (style vue-cwl)
     */
    createNodePorts(nodeId, type, position, color) {
        const ports = [];
        const portRadius = 4;
        
        // Input ports (left side)
        if (type === 'step' || type === 'output') {
            const inputPorts = this.getNodeInputPorts(nodeId);
            inputPorts.forEach((portInfo, i) => {
                const port = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                const y = position.y + position.height * (0.25 + 0.5 * i / Math.max(1, inputPorts.length - 1));
                
                port.setAttribute('cx', position.x - 2);
                port.setAttribute('cy', isNaN(y) ? position.y + position.height * 0.5 : y);
                port.setAttribute('r', portRadius);
                port.setAttribute('fill', this.getPortColor(portInfo.type));
                port.setAttribute('stroke', color.border);
                port.setAttribute('stroke-width', '2');
                port.setAttribute('class', 'cwl-port cwl-port-input');
                port.setAttribute('data-port-type', 'input');
                port.setAttribute('data-port-id', portInfo.id);
                port.setAttribute('data-port-cwl-type', portInfo.type);
                port.setAttribute('data-port-name', portInfo.name || portInfo.id);
                port.setAttribute('data-node-id', nodeId);
                
                // Tooltip avec informations du port
                port.setAttribute('title', `${portInfo.name || portInfo.id} (${portInfo.type})`);
                
                // Gestionnaires d'événements pour les ports
                this.setupPortInteraction(port, portInfo, nodeId);
                
                ports.push(port);
            });
        }
        
        // Output ports (right side)
        if (type === 'input' || type === 'step') {
            const outputPorts = this.getNodeOutputPorts(nodeId);
            outputPorts.forEach((portInfo, i) => {
                const port = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                const y = position.y + position.height * (0.25 + 0.5 * i / Math.max(1, outputPorts.length - 1));
                
                port.setAttribute('cx', position.x + position.width + 2);
                port.setAttribute('cy', isNaN(y) ? position.y + position.height * 0.5 : y);
                port.setAttribute('r', portRadius);
                port.setAttribute('fill', this.getPortColor(portInfo.type));
                port.setAttribute('stroke', color.shadow);
                port.setAttribute('stroke-width', '2');
                port.setAttribute('class', 'cwl-port cwl-port-output');
                port.setAttribute('data-port-type', 'output');
                port.setAttribute('data-port-id', portInfo.id);
                port.setAttribute('data-port-cwl-type', portInfo.type);
                port.setAttribute('data-port-name', portInfo.name || portInfo.id);
                port.setAttribute('data-node-id', nodeId);
                
                // Tooltip avec informations du port
                port.setAttribute('title', `${portInfo.name || portInfo.id} (${portInfo.type})`);
                
                // Gestionnaires d'événements pour les ports
                this.setupPortInteraction(port, portInfo, nodeId);
                
                ports.push(port);
            });
        }
        
        return ports;
    }

    /**
     * Retrieve node information for icon and style
     */
    getNodeInfo(nodeId) {
        // Check if it's an input
        if (this.workflow.inputs[nodeId]) {
            const input = this.workflow.inputs[nodeId];
            return {
                id: nodeId,
                type: 'input',
                cwlType: input.type,
                cwlItems: this.extractArrayItemType(input.type),
                label: input.label || nodeId
            };
        }
        
        // Check if it's a step
        if (this.workflow.steps[nodeId]) {
            const step = this.workflow.steps[nodeId];
            return {
                id: nodeId,
                type: 'step',
                cwlClass: this.extractCwlClass(step.run),
                label: step.label || nodeId
            };
        }
        
        // Check if it's an output
        if (this.workflow.outputs[nodeId]) {
            const output = this.workflow.outputs[nodeId];
            return {
                id: nodeId,
                type: 'output',
                cwlType: output.type,
                cwlItems: this.extractArrayItemType(output.type),
                label: output.label || nodeId
            };
        }
        
        // Fallback
        return {
            id: nodeId,
            type: 'unknown',
            label: nodeId
        };
    }

    /**
     * Extrait le type d'élément d'un array CWL
     */
    extractArrayItemType(type) {
        if (Array.isArray(type)) {
            const arrayType = type.find(t => typeof t === 'object' && t.type === 'array');
            return arrayType ? arrayType.items : null;
        }
        if (typeof type === 'object' && type.type === 'array') {
            return type.items;
        }
        return null;
    }

    /**
     * Extrait la classe CWL d'un run path
     */
    extractCwlClass(runPath) {
        if (typeof runPath === 'string') {
            if (runPath.includes('workflow') || runPath.endsWith('.cwl')) {
                return 'Workflow';
            }
        }
        return 'CommandLineTool'; // Default
    }

    /**
     * Get SVG icon for a node type (authentic cwl-svg)
     */
    getNodeIcon(node) {
        // Detect exact type according to cwl-svg logic
        if (node.type === 'input' && node.cwlType) {
            if (node.cwlType === 'File' || (node.cwlType === 'array' && node.cwlItems === 'File')) {
                return '<svg class="node-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 499 462.86" y="-10" x="-11" width="20" height="20"><title>file_input</title><path d="M386.06,0H175V58.29l50,50V50H337.81V163.38h25l86.19.24V412.86H225V353.71l-50,50v59.15H499V112.94Zm1.75,113.45v-41l41.1,41.1Z"/><polygon points="387.81 1.06 387.81 1.75 387.12 1.06 387.81 1.06"/><polygon points="290.36 231 176.68 344.68 141.32 309.32 194.64 256 0 256 0 206 194.64 206 141.32 152.68 176.68 117.32 290.36 231"/></svg>';
            } else {
                return '<svg class="node-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 499 365" x="-11" y="-10" width="20" height="20"><title>type_input</title><g id="input"><path d="M316.5,68a181.72,181.72,0,0,0-114.12,40.09L238,143.72a132.5,132.5,0,1,1,1.16,214.39L203.48,393.8A182.5,182.5,0,1,0,316.5,68Z" transform="translate(0 -68)"/><g id="Layer_22" data-name="Layer 22"><g id="Layer_9_copy_4" data-name="Layer 9 copy 4"><polygon points="290.36 182 176.68 295.68 141.32 260.32 219.64 182 141.32 103.68 176.68 68.32 290.36 182"/></g></g></g></svg>';
            }
        } else if (node.type === 'output' && node.cwlType) {
            if (node.cwlType === 'File' || (node.cwlType === 'array' && node.cwlItems === 'File')) {
                return '<svg class="node-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 499 462.86" x="-7" y="-11" width="20" height="20"><title>file_output</title><polygon points="387.81 1.06 387.81 1.75 387.12 1.06 387.81 1.06"/><polygon points="499 231 385.32 344.68 349.96 309.32 403.28 256 208.64 256 208.64 206 403.28 206 350.96 153.68 386.32 118.32 499 231"/><path d="M187.81,163.38l77.69.22H324V112.94L211.06,0H0V462.86H324V298.5H274V412.86H50V50H187.81Z"/></svg>';
            } else {
                return '<svg class="node-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500.36 365" x="-9" y="-10" width="20" height="20"><title>type_output</title><g id="output"><path d="M291.95,325.23a134,134,0,0,1-15.76,19,132.5,132.5,0,1,1,0-187.38,133.9,133.9,0,0,1,16.16,19.55l35.81-35.81A182.5,182.5,0,1,0,327.73,361Z" transform="translate(0 -68)"/><g id="circle_source_copy" data-name="circle source copy"><g id="Layer_22_copy" data-name="Layer 22 copy"><g id="Layer_9_copy_5" data-name="Layer 9 copy 5"><polygon points="209.04 182 322.72 68.32 358.08 103.68 279.76 182 358.08 260.32 322.72 295.68 209.04 182"/></g></g></g></g></svg>';
            }
        } else if (node.type === 'step' && node.cwlClass) {
            if (node.cwlClass === 'Workflow') {
                return '<svg class="node-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400.01 399.88" x="-9" y="-10" width="20" height="20"><title>workflow</title><path d="M400,200a80,80,0,0,1-140.33,52.53L158.23,303.24a80,80,0,1,1-17.9-35.77l101.44-50.71a80.23,80.23,0,0,1,0-33.52L140.33,132.53a79.87,79.87,0,1,1,17.9-35.77l101.44,50.71A80,80,0,0,1,400,200Z" transform="translate(0.01 -0.16)"/></svg>';
            } else {
                return '<svg class="node-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 398.39 397.78" x="-10" y="-8" width="20" height="15"><title>tool2</title><polygon points="38.77 397.57 0 366 136.15 198.78 0 31.57 38.77 0 200.63 198.78 38.77 397.57"/><rect x="198.39" y="347.78" width="200" height="50"/></svg>';
            }
        }
        
        // Default fallback - tool icon
        return '<svg class="node-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 398.39 397.78" x="-10" y="-8" width="20" height="15"><title>tool2</title><polygon points="38.77 397.57 0 366 136.15 198.78 0 31.57 38.77 0 200.63 198.78 38.77 397.57"/><rect x="198.39" y="347.78" width="200" height="50"/></svg>';
    }

    /**
     * Create icon element from SVG
     */
    createIconElement(iconSvg) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(iconSvg, 'image/svg+xml');
        const iconElement = document.importNode(doc.documentElement, true);
        return iconElement;
    }

    /**
     * Create ports with authentic cwl-svg style
     */
    createNodePortsCWLSVG(nodeId, nodeType, nodeRadius, inputPorts, outputPorts) {
        const ports = [];
        
        // Input ports (left side)
        if (nodeType === 'step' || nodeType === 'output') {
            inputPorts.forEach((portInfo, index) => {
                const portMatrix = this.createPortMatrix(inputPorts.length, index, nodeRadius, 'input');
                const port = this.createPortElement(portInfo, 'input', portMatrix, nodeId);
                ports.push(port);
            });
        }
        
        // Output ports (right side)
        if (nodeType === 'input' || nodeType === 'step') {
            outputPorts.forEach((portInfo, index) => {
                const portMatrix = this.createPortMatrix(outputPorts.length, index, nodeRadius, 'output');
                const port = this.createPortElement(portInfo, 'output', portMatrix, nodeId);
                ports.push(port);
            });
        }
        
        return ports;
    }

    /**
     * Calculate transformation matrix for a port (exactly like cwl-svg GraphNode.createPortMatrix)
     */
    createPortMatrix(totalPortLength, portIndex, radius, type) {
        const availableAngle = 140; // Exactly like cwl-svg

        let rotationAngle;
        if (type === "output") {
            // For output ports (right side)
            rotationAngle = (-availableAngle / 2) + ((portIndex + 1) * availableAngle / (totalPortLength + 1));
        } else {
            // For input ports (left side)
            rotationAngle = 180 - (availableAngle / -2) - ((portIndex + 1) * availableAngle / (totalPortLength + 1));
        }

        // Convert to radians
        const radians = (rotationAngle * Math.PI) / 180;
        
        // Calculate position on circle (identical to cwl-svg)
        const x = radius * Math.cos(radians);
        const y = radius * Math.sin(radians);
        
        return { x, y };
    }

    /**
     * Crée un élément port avec le style cwl-svg authentique
     */
    createPortElement(portInfo, portType, matrix, nodeId) {
        const portClass = portType === "input" ? "input-port" : "output-port";
        const label = portInfo.label || portInfo.id;

        // Create port group directly with SVG DOM
        const portGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        portGroup.setAttribute('class', `port ${portClass} cwl-port cwl-port-${portType}`);
        portGroup.setAttribute('transform', `matrix(1, 0, 0, 1, ${matrix.x}, ${matrix.y})`);
        portGroup.setAttribute('data-connection-id', portInfo.connectionId || portInfo.id);
        portGroup.setAttribute('data-port-id', portInfo.id);
        portGroup.setAttribute('data-port-type', portType);
        // Add cx, cy attributes for getPortPosition
        portGroup.setAttribute('cx', matrix.x);
        portGroup.setAttribute('cy', matrix.y);

        // Create io-port group
        const ioPortGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        ioPortGroup.setAttribute('class', 'io-port');

        // Create port circle (visible!)
        const portCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        portCircle.setAttribute('cx', '0');
        portCircle.setAttribute('cy', '0');
        portCircle.setAttribute('r', '5');
        portCircle.setAttribute('class', 'port-handle');

        // Create port label
        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('x', portType === 'input' ? '-15' : '15');
        labelText.setAttribute('y', '4');
        labelText.setAttribute('text-anchor', portType === 'input' ? 'end' : 'start');
        labelText.setAttribute('class', 'label unselectable');
        labelText.setAttribute('font-size', '10');
        labelText.setAttribute('fill', '#666');
        labelText.textContent = label;

        // Assemble elements
        ioPortGroup.appendChild(portCircle);
        portGroup.appendChild(ioPortGroup);
        portGroup.appendChild(labelText);
        
        // Event handlers
        this.setupPortInteraction(portGroup, portInfo, nodeId);
        
        return portGroup;
    }

    /**
     * Configure interaction with a port
     */
    setupPortInteraction(portElement, portInfo, nodeId) {
        // Prevent propagation to parent node
        portElement.style.cursor = 'pointer';
        
        // Display port name on hover
        portElement.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            this.showPortLabel(portElement, portInfo);
        });
        
        portElement.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            this.hidePortLabel();
        });
        
        // Click on port to display details
        portElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showPortDetails(nodeId, portInfo);
        });
        
        // Allow mousedown/mousemove to propagate so both node-drag and port-drag
        // handlers (delegated on the workflow root) can start. Previously we
        // stopped propagation here which prevented the NodeMove plugin from
        // receiving the events when ports were clicked/dragged.
        // Keep click/hover propagation blocked to avoid accidental selection.
        portElement.addEventListener('mousedown', (e) => {
            // Intentionally do not stop propagation here.
        });

        portElement.addEventListener('mousemove', (e) => {
            // Intentionally do not stop propagation here.
        });
    }

    /**
     * Get SVG icon for a port type
     */
    getPortTypeIcon(portType, size = 12) {
        const type = this.formatPortType(portType).toLowerCase();
        
        // Icons based on cwl-svg
        const icons = {
            'file': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 1.5C4 .67 4.67 0 5.5 0h5C11.33 0 12 .67 12 1.5v13c0 .83-.67 1.5-1.5 1.5h-5C4.67 16 4 15.33 4 14.5V1.5zm7 0v13h-5v-13h5z"/>
                <path d="M6 3h3v1H6V3zm0 2h3v1H6V5zm0 2h3v1H6V7z"/>
            </svg>`,
            'directory': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.5 2A1.5 1.5 0 000 3.5v9A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0014.5 4H7.62l-.92-1.38A1.5 1.5 0 005.38 2H1.5z"/>
            </svg>`,
            'string': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.5 4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0 4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0 4a.5.5 0 01.5-.5h6a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/>
            </svg>`,
            'int': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7.5 5.5a.5.5 0 00-1 0v5a.5.5 0 001 0v-5zm2 0a.5.5 0 00-1 0v5a.5.5 0 001 0v-5z"/>
                <path d="M2 3a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V3z"/>
            </svg>`,
            'long': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.5 5.5a.5.5 0 00-1 0v5a.5.5 0 001 0v-5zm2 0a.5.5 0 00-1 0v5a.5.5 0 001 0v-5zm2 0a.5.5 0 00-1 0v5a.5.5 0 001 0v-5z"/>
                <path d="M2 3a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V3z"/>
            </svg>`,
            'float': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="8" r="1"/>
                <path d="M7.5 5.5a.5.5 0 00-1 0v5a.5.5 0 001 0v-5zm2 0a.5.5 0 00-1 0v5a.5.5 0 001 0v-5z"/>
                <path d="M2 3a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V3z"/>
            </svg>`,
            'double': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="4" cy="8" r="1"/>
                <circle cx="6" cy="8" r="1"/>
                <path d="M8.5 5.5a.5.5 0 00-1 0v5a.5.5 0 001 0v-5zm2 0a.5.5 0 00-1 0v5a.5.5 0 001 0v-5z"/>
                <path d="M2 3a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V3z"/>
            </svg>`,
            'boolean': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z"/>
                <path d="M10.97 4.97a.235.235 0 00-.02.022L7.477 9.417 5.384 7.323a.75.75 0 00-1.06 1.06L6.97 11.03a.75.75 0 001.079-.02l3.992-4.99a.75.75 0 00-1.071-1.05z"/>
            </svg>`,
            'array': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zM2.5 2a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5h-3z"/>
                <path d="M9 2.5A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm1.5-.5a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5h-3z"/>
                <path d="M1 10.5A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm1.5-.5a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5h-3z"/>
                <path d="M9 10.5A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3zm1.5-.5a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5h-3z"/>
            </svg>`
        };
        
        return icons[type] || icons['string']; // Default: string icon
    }

    /**
     * Format port type for display
     */
    formatPortType(portType) {
        if (!portType) return '';
        
        // Si c'est un string simple
        if (typeof portType === 'string') {
            return portType;
        }
        
        // Si c'est un objet avec type
        if (typeof portType === 'object') {
            if (portType.type) {
                return this.formatPortType(portType.type);
            }
            if (Array.isArray(portType)) {
                // Pour les types union (ex: [null, string])
                return portType.map(t => this.formatPortType(t)).join('|');
            }
        }
        
        return String(portType);
    }

    /**
     * Return appropriate SVG icon for a port type
     */
    getPortTypeIcon(portType, isInput = true) {
        const type = this.formatPortType(portType).toLowerCase();
        
        // Icons for File types
        if (type.includes('file')) {
            if (isInput) {
                return '<svg class="port-type-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 499 462.86" y="-2" x="-2" width="12" height="12"><title>file_input</title><path d="M386.06,0H175V58.29l50,50V50H337.81V163.38h25l86.19.24V412.86H225V353.71l-50,50v59.15H499V112.94Zm1.75,113.45v-41l41.1,41.1Z" fill="currentColor"/><polygon points="387.81 1.06 387.81 1.75 387.12 1.06 387.81 1.06" fill="currentColor"/><polygon points="290.36 231 176.68 344.68 141.32 309.32 194.64 256 0 256 0 206 194.64 206 141.32 152.68 176.68 118.32 290.36 231" fill="currentColor"/></svg>';
            } else {
                return '<svg class="port-type-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 499 462.86" x="-2" y="-2" width="12" height="12"><title>file_output</title><polygon points="387.81 1.06 387.81 1.75 387.12 1.06 387.81 1.06" fill="currentColor"/><polygon points="499 231 385.32 344.68 349.96 309.32 403.28 256 208.64 256 208.64 206 403.28 206 350.96 153.68 386.32 118.32 499 231" fill="currentColor"/><path d="M187.81,163.38l77.69.22H324V112.94L211.06,0H0V462.86H324V298.5H274V412.86H50V50H161.06L187.81,76.75Z" fill="currentColor"/></svg>';
            }
        }
        
        // Icons for Directory types
        if (type.includes('directory')) {
            return '<svg class="port-type-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" x="-2" y="-2" width="12" height="12"><path d="M3 4h6l2 2h10v12H3V4z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
        }
        
        // Icons for numeric types
        if (type.includes('int') || type.includes('float') || type.includes('double') || type.includes('long')) {
            return '<svg class="port-type-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" x="-2" y="-2" width="12" height="12"><text x="12" y="16" text-anchor="middle" font-size="14" font-weight="bold" fill="currentColor">#</text></svg>';
        }
        
        // Icons for boolean types
        if (type.includes('boolean')) {
            return '<svg class="port-type-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" x="-2" y="-2" width="12" height="12"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
        }
        
        // Icons for string/text types
        if (type.includes('string') || type.includes('text')) {
            return '<svg class="port-type-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" x="-2" y="-2" width="12" height="12"><path d="M3 7h18M3 12h18M3 17h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
        }
        
        // Icons for array types
        if (type.includes('array') || type.includes('[]')) {
            return '<svg class="port-type-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" x="-2" y="-2" width="12" height="12"><path d="M6 6h2v12H6M16 6h2v12h-2M10 9h4M10 12h4M10 15h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
        }
        
        // Default icon for unknown types
        return '<svg class="port-type-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" x="-2" y="-2" width="12" height="12"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="12" y="16" text-anchor="middle" font-size="10" fill="currentColor">?</text></svg>';
    }

    /**
     * Try to infer a basic type based on port name
     */
    inferPortType(portName) {
        const name = portName.toLowerCase();
        
        if (name.includes('file') || name.includes('input') || name.includes('output')) {
            return 'File';
        }
        if (name.includes('param') || name.includes('value')) {
            return 'string';
        }
        if (name.includes('count') || name.includes('number') || name.includes('size')) {
            return 'int';
        }
        if (name.includes('flag') || name.includes('enable') || name.includes('disable')) {
            return 'boolean';
        }
        
        return null; // No type inferred
    }

    /**
     * Display port label on hover
     */
    showPortLabel(portElement, portInfo, portType = 'input') {
        const portName = portInfo.name || portInfo.id;
        const typeStr = this.formatPortType(portInfo.type);
        const displayText = typeStr ? `${portName}: ${typeStr}` : portName;
        
        // Calculer la position absolue du port
        const nodeGroup = portElement.closest('[data-id]');
        if (!nodeGroup) return;
        
        const nodeId = nodeGroup.getAttribute('data-id');
        const nodeTransform = nodeGroup.getAttribute('transform');
        const nodeMatches = nodeTransform.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),\s*([^)]+)\)/);
        if (!nodeMatches) return;
        
        const nodeX = parseFloat(nodeMatches[1]);
        const nodeY = parseFloat(nodeMatches[2]);
        const portCx = parseFloat(portElement.getAttribute('cx'));
        const portCy = parseFloat(portElement.getAttribute('cy'));
        
        const absoluteX = nodeX + portCx;
        const absoluteY = nodeY + portCy;
        
        // With larger nodes, no need for Y adjustment - ports are well spaced
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        label.setAttribute('class', 'port-label');
        label.setAttribute('data-node-id', nodeId);
        label.setAttribute('data-port-id', portInfo.id || portInfo.name);
        label.setAttribute('data-port-type', portType);
        
        // Calculate actual text width (improved approximation)
        const baseIconWidth = portInfo.type ? 16 : 0; // Icon width + margin
        const textWidth = displayText.length * 7; // Approximate text width with type
        const padding = 4; // Further reduced padding for more compact backgrounds
        const rectWidth = textWidth + padding + baseIconWidth;
        
        // Get port index for intelligent spacing
        const allPortsOfType = nodeGroup.querySelectorAll(`[data-port-type="${portType}"]`);
        let portIndex = Array.from(allPortsOfType).indexOf(portElement);
        
        // Get SVG bounds to avoid overflow
        const viewBox = this.svg.getAttribute('viewBox').split(' ');
        const svgWidth = parseFloat(viewBox[2]);
        const svgHeight = parseFloat(viewBox[3]);
        
        // Label position based on port type - with spacing to avoid covering the port
        let rectX, textX, textAnchor;
        if (portType === 'input') {
            // Labels on left for input ports - spacing to avoid port overlap
            rectX = absoluteX - rectWidth - 8; // 8px left of port to avoid overlap
            
            // Prevent overflow on left
            if (rectX < 10) {
                rectX = 10;
            }
            
            textX = rectX + padding/2;
            textAnchor = 'start';
        } else {
            // Labels on right for output ports - spacing to avoid port overlap
            rectX = absoluteX + 8; // 8px right of port to avoid overlap
            
            // Prevent overflow on right
            if (rectX + rectWidth > svgWidth - 10) {
                rectX = svgWidth - rectWidth - 10;
            }
            
            textX = rectX + padding/2;
            textAnchor = 'start';
        }
        
        // Couleur de fond du visualiseur (#303030)
        const bgColor = '#303030';
        
        // Obtenir l'icône pour le type de port
        const typeIcon = portInfo.type ? this.getPortTypeIcon(portInfo.type) : '';
        const hasIcon = typeIcon.length > 0;
        
        // Ajuster la largeur et position si on a une icône
        let finalRectX = rectX;
        let finalTextX = textX;
        let iconX = rectX;
        
        if (hasIcon) {
            if (portType === 'input') {
                // Pour les inputs, icône à gauche du texte
                iconX = rectX + 2;
                finalTextX = textX + 16; // Décaler le texte pour laisser place à l'icône
            } else {
                // Pour les outputs, icône à droite du texte
                iconX = rectX + rectWidth - 14; // Position l'icône à droite dans le rectangle
            }
        }

        // Fond du label - même couleur que le background du visualiseur
        const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        labelBg.setAttribute('x', finalRectX);
        labelBg.setAttribute('y', absoluteY - 8); // Position verticale ajustée pour être moins haute
        labelBg.setAttribute('width', rectWidth);
        labelBg.setAttribute('height', 16); // Hauteur réduite pour un background plus compact
        labelBg.setAttribute('fill', bgColor); // Même couleur que le fond
        labelBg.setAttribute('opacity', '1'); // Opacité complète pour se fondre dans le background
        labelBg.setAttribute('rx', '4');
        // Pas de bordure pour se fondre parfaitement dans le background
        
        // Texte du label - blanc pour contraster avec #303030
        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('x', finalTextX);
        labelText.setAttribute('y', absoluteY + 3); // Position ajustée avec la nouvelle hauteur du background
        labelText.setAttribute('fill', '#ffffff'); // Texte blanc sur fond #303030
        labelText.setAttribute('font-size', '11');
        labelText.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
        labelText.setAttribute('text-anchor', textAnchor);
        labelText.textContent = displayText;
        
        // Ajouter l'icône SVG si disponible
        let iconElement = null;
        if (hasIcon) {
            iconElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            iconElement.setAttribute('transform', `translate(${iconX}, ${absoluteY - 6})`);
            iconElement.innerHTML = typeIcon;
            
            // Appliquer la couleur blanche à l'icône
            const iconSvg = iconElement.querySelector('svg');
            if (iconSvg) {
                iconSvg.setAttribute('fill', '#ffffff');
                iconSvg.style.color = '#ffffff';
            }
        }
        
        label.appendChild(labelBg);
        label.appendChild(labelText);
        if (iconElement) {
            label.appendChild(iconElement);
        }
        
        this.mainGroup.appendChild(label);
    }

    /**
     * Cache le label du port
     */
    hidePortLabel() {
        const existingLabels = this.mainGroup.querySelectorAll('.port-label:not([data-node-id])');
        existingLabels.forEach(label => label.remove());
    }

    /**
     * Affiche les détails d'un port spécifique
     */
    showPortDetails(nodeId, portInfo) {
        // Supprimer les anciens détails
        this.clearPortDetails();
        
        const nodeGroup = this.mainGroup.querySelector(`[data-id="${nodeId}"]`);
        const nodeRect = nodeGroup.querySelector('rect');
        const nodeX = parseFloat(nodeRect.getAttribute('x'));
        const nodeY = parseFloat(nodeRect.getAttribute('y'));
        const nodeWidth = parseFloat(nodeRect.getAttribute('width'));
        
        // Créer le panneau de détails du port
        const detailsPanel = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        detailsPanel.setAttribute('class', 'port-details-panel');
        
        // Fond du panneau
        const panelWidth = 180;
        const panelHeight = 80;
        const panelX = nodeX + nodeWidth + 20;
        const panelY = nodeY - 10;
        
        const panelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        panelBg.setAttribute('x', panelX);
        panelBg.setAttribute('y', panelY);
        panelBg.setAttribute('width', panelWidth);
        panelBg.setAttribute('height', panelHeight);
        panelBg.setAttribute('fill', '#ffffff');
        panelBg.setAttribute('stroke', '#e5e7eb');
        panelBg.setAttribute('stroke-width', '1');
        panelBg.setAttribute('rx', '8');
        panelBg.setAttribute('filter', 'drop-shadow(2px 2px 8px rgba(0,0,0,0.15))');
        
        detailsPanel.appendChild(panelBg);
        
        // Titre
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', panelX + 10);
        title.setAttribute('y', panelY + 20);
        title.setAttribute('fill', '#1f2937');
        title.setAttribute('font-size', '12');
        title.setAttribute('font-weight', 'bold');
        title.textContent = 'Port Details';
        
        detailsPanel.appendChild(title);
        
        // Nom du port
        const nameLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameLabel.setAttribute('x', panelX + 10);
        nameLabel.setAttribute('y', panelY + 38);
        nameLabel.setAttribute('fill', '#374151');
        nameLabel.setAttribute('font-size', '11');
        nameLabel.textContent = `Nom: ${portInfo.name || portInfo.id}`;
        
        detailsPanel.appendChild(nameLabel);
        
        // Type du port
        const typeLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        typeLabel.setAttribute('x', panelX + 10);
        typeLabel.setAttribute('y', panelY + 54);
        typeLabel.setAttribute('fill', '#374151');
        typeLabel.setAttribute('font-size', '11');
        typeLabel.textContent = `Type: ${portInfo.type}`;
        
        detailsPanel.appendChild(typeLabel);
        
        // Indicateur de couleur du type
        const colorIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        colorIndicator.setAttribute('cx', panelX + panelWidth - 15);
        colorIndicator.setAttribute('cy', panelY + 15);
        colorIndicator.setAttribute('r', '6');
        colorIndicator.setAttribute('fill', this.getPortColor(portInfo.type));
        colorIndicator.setAttribute('stroke', '#ffffff');
        colorIndicator.setAttribute('stroke-width', '2');
        
        detailsPanel.appendChild(colorIndicator);
        
        // Bouton de fermeture
        const closeButton = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        closeButton.setAttribute('x', panelX + panelWidth - 12);
        closeButton.setAttribute('y', panelY + 12);
        closeButton.setAttribute('fill', '#6b7280');
        closeButton.setAttribute('font-size', '14');
        closeButton.setAttribute('font-weight', 'bold');
        closeButton.setAttribute('cursor', 'pointer');
        closeButton.textContent = '×';
        
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clearPortDetails();
        });
        
        detailsPanel.appendChild(closeButton);
        
        this.mainGroup.appendChild(detailsPanel);
    }

    /**
     * Retourne la couleur d'un port selon son type CWL
     */
    getPortColor(cwlType) {
        const typeColors = {
            'string': '#22c55e',
            'int': '#3b82f6', 
            'float': '#8b5cf6',
            'boolean': '#f59e0b',
            'File': '#ef4444',
            'Directory': '#84cc16',
            'Any': '#6b7280',
            'null': '#9ca3af'
        };
        
        // Extraire le type de base (supprimer array, optional, etc.)
        const baseType = this.extractBaseType(cwlType);
        return typeColors[baseType] || '#64748b';
    }

    /**
     * Extrait le type de base d'un type CWL complexe
     */
    extractBaseType(cwlType) {
        if (typeof cwlType === 'string') {
            return cwlType.replace(/[\[\]?]/g, ''); // Supprimer array et optional
        }
        
        if (Array.isArray(cwlType)) {
            // Union type - prendre le premier non-null
            const nonNullType = cwlType.find(t => t !== 'null');
            return nonNullType ? this.extractBaseType(nonNullType) : 'Any';
        }
        
        if (typeof cwlType === 'object' && cwlType.type) {
            return this.extractBaseType(cwlType.type);
        }
        
        return 'Any';
    }

    /**
     * Récupère les informations détaillées des ports d'entrée
     */
    getNodeInputPorts(nodeId) {
        const ports = [];
        
        if (this.workflow.steps[nodeId] && this.workflow.steps[nodeId].in) {
            Object.entries(this.workflow.steps[nodeId].in).forEach(([portId, portDef]) => {
                ports.push({
                    id: portId,
                    name: portId,
                    type: this.inferPortType(portDef) || 'Any'
                });
            });
        } else if (this.workflow.outputs[nodeId]) {
            // Port d'entrée pour un output (connecté à une source)
            ports.push({
                id: 'input',
                name: 'input', 
                type: this.workflow.outputs[nodeId].type || 'Any'
            });
        }
        
        return ports;
    }

    /**
     * Récupère les informations détaillées des ports de sortie
     */
    getNodeOutputPorts(nodeId) {
        const ports = [];
        
        if (this.workflow.inputs[nodeId]) {
            // Input node - un seul port de sortie
            ports.push({
                id: 'output',
                name: this.workflow.inputs[nodeId].label || nodeId,
                type: this.workflow.inputs[nodeId].type || 'Any'
            });
        } else if (this.workflow.steps[nodeId] && this.workflow.steps[nodeId].out) {
            // Step node - ports basés sur les outputs
            this.workflow.steps[nodeId].out.forEach(outId => {
                ports.push({
                    id: outId,
                    name: outId,
                    type: 'Any' // Type à inférer depuis le tool
                });
            });
        }
        
        console.log(`🔍 Output ports for ${nodeId}:`, ports.map(p => p.id));
        return ports;
    }

    /**
     * Infère le type d'un port à partir de sa définition
     */
    inferPortType(portDef) {
        if (typeof portDef === 'string') {
            return 'Any';
        }
        
        if (portDef && portDef.type) {
            return portDef.type;
        }
        
        if (portDef && portDef.source) {
            // Type basé sur la source - nécessite résolution
            return this.resolveSourceType(portDef.source);
        }
        
        return 'Any';
    }

    /**
     * Résout le type d'une source de connexion
     */
    resolveSourceType(source) {
        // Vérifier dans les inputs du workflow
        if (this.workflow.inputs[source]) {
            return this.workflow.inputs[source].type || 'Any';
        }
        
        // Vérifier dans les steps (format step/output)
        const stepMatch = source.match(/^(.+)\/(.+)$/);
        if (stepMatch) {
            const [, stepId, outputId] = stepMatch;
            // Ici on pourrait analyser le tool du step pour connaître le type
            // Pour l'instant, retourner Any
            return 'Any';
        }
        
        return 'Any';
    }

    /**
     * Compte les entrées d'un nœud (méthode de compatibilité)
     */
    getNodeInputCount(nodeId) {
        return this.getNodeInputPorts(nodeId).length;
        return this.workflow.connections.filter(conn => conn.to.id === nodeId).length || 1;
    }

    /**
     * Compte les sorties d'un nœud
     */
    getNodeOutputCount(nodeId) {
        if (this.workflow.steps[nodeId] && this.workflow.steps[nodeId].out) {
            return this.workflow.steps[nodeId].out.length;
        }
        return this.workflow.connections.filter(conn => conn.from.id === nodeId).length || 1;
    }
    
    /**
     * Rend le workflow en SVG
     */
    render() {
        console.log('🔍 Starting render, workflow:', this.workflow);
        if (!this.workflow) {
            console.log('❌ No workflow to render');
            return;
        }
        
        // Clean SVG
        this.mainGroup.innerHTML = '';
        
        const layout = this.calculateLayout();
        console.log('🔍 Layout calculated:', layout);
        
        // Render nodes first
        this.renderNodes(layout);
        
        console.log('🔍 Nodes added to DOM:', this.mainGroup.querySelectorAll('.node').length);
        
        // Render connections after (so they can find ports)
        this.renderConnections(layout);
        
        // Ajuster la vue
        this.fitToContent();
    }
    
    /**
     * Rend les connexions directes entre ports (sans flèches)
     */
    renderConnections(layout) {
        console.log('🔗 Starting connection rendering:', this.workflow.connections.length);
        
        this.workflow.connections.forEach((conn, index) => {
            console.log(`🔗 Connection ${index}:`, conn);
            
            const fromPos = layout.nodes[conn.from.id];
            const toPos = layout.nodes[conn.to.id];
            
            console.log(`🔗 Positions - From: ${conn.from.id}:`, fromPos, `To: ${conn.to.id}:`, toPos);
            
            if (!fromPos || !toPos) {
                console.log('❌ Position manquante pour la connexion');
                return;
            }
            
            // Calculer positions exactes des ports (authentique cwl-svg)
            let fromPortPos = this.getPortPosition(conn.from.id, conn.from.port, 'output', fromPos);
            let toPortPos = this.getPortPosition(conn.to.id, conn.to.port, 'input', toPos);
            
            console.log(`🔗 Port positions - From: ${conn.from.port}:`, fromPortPos, `To: ${conn.to.port}:`, toPortPos);
            
            if (!fromPortPos || !toPortPos) {
                console.log('⚠️ Utilisation des positions de fallback');
                console.log(`⚠️ From port missing: ${!fromPortPos}, To port missing: ${!toPortPos}`);
                
                // Fallback intelligent vers les bords des nœuds
                if (!fromPortPos) {
                    // Pour le nœud source, utiliser le bord droit
                    fromPortPos = { x: fromPos.x + 60, y: fromPos.y }; 
                }
                if (!toPortPos) {
                    // Pour le nœud cible, utiliser le bord gauche
                    toPortPos = { x: toPos.x - 60, y: toPos.y }; 
                }
                
                console.log(`⚠️ Fallback positions - From: (${fromPortPos.x}, ${fromPortPos.y}), To: (${toPortPos.x}, ${toPortPos.y})`);
            }
            
            // Générer le chemin avec l'algorithme authentique cwl-svg
            const pathData = this.makeConnectionPath(
                fromPortPos.x, 
                fromPortPos.y, 
                toPortPos.x, 
                toPortPos.y, 
                'right'
            );
            
            // Créer le groupe d'edge authentique cwl-svg (avec double path)
            const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            edgeGroup.setAttribute('class', 'edge');
            edgeGroup.setAttribute('tabindex', '-1');
            edgeGroup.setAttribute('data-connection-index', index);
            edgeGroup.setAttribute('data-source-connection', `${conn.from.id}/${conn.from.port}`);
            edgeGroup.setAttribute('data-destination-connection', `${conn.to.id}/${conn.to.port}`);
            edgeGroup.setAttribute('data-source-node', conn.from.id);
            edgeGroup.setAttribute('data-destination-node', conn.to.id);
            edgeGroup.setAttribute('data-source-port', conn.from.port);
            edgeGroup.setAttribute('data-destination-port', conn.to.port);
            
            // Path outer (authentique cwl-svg)
            const outerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            outerPath.setAttribute('class', 'sub-edge outer');
            outerPath.setAttribute('d', pathData);
            
            // Path inner (authentique cwl-svg)
            const innerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            innerPath.setAttribute('class', 'sub-edge inner');
            innerPath.setAttribute('d', pathData);
            
            edgeGroup.appendChild(outerPath);
            edgeGroup.appendChild(innerPath);
            
            // Insérer avant les nœuds (ordre Z authentique)
            const firstNode = this.mainGroup.querySelector('.node');
            if (firstNode) {
                this.mainGroup.insertBefore(edgeGroup, firstNode);
            } else {
                this.mainGroup.appendChild(edgeGroup);
            }
        });
    }

    /**
     * Fonction de connexion authentique cwl-svg (adaptée de Workflow.makeConnectionPath)
     */
    makeConnectionPath(x1, y1, x2, y2, forceDirection = 'right') {
        if (!forceDirection) {
            return `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
        } else if (forceDirection === 'right') {
            const outDir = x1 + Math.abs(x1 - x2) / 2;
            const inDir = x2 - Math.abs(x1 - x2) / 2;
            return `M ${x1} ${y1} C ${outDir} ${y1} ${inDir} ${y2} ${x2} ${y2}`;
        } else if (forceDirection === 'left') {
            const outDir = x1 - Math.abs(x1 - x2) / 2;
            const inDir = x2 + Math.abs(x1 - x2) / 2;
            return `M ${x1} ${y1} C ${outDir} ${y1} ${inDir} ${y2} ${x2} ${y2}`;
        }
    }

    /**
     * Calcule la position exacte d'un port sur un nœud
     */
    getPortPosition(nodeId, portId, portType, nodeLayout) {
        const nodeGroup = this.mainGroup.querySelector(`[data-id="${nodeId}"]`);
        if (!nodeGroup) {
            console.log(`❌ Node group not found: ${nodeId}`);
            return null;
        }
        
        const port = nodeGroup.querySelector(`.cwl-port[data-port-id="${portId}"]`);
        if (!port) {
            console.log(`❌ Port not found: ${portId} in node ${nodeId}`);
            // Debug: lister tous les ports disponibles
            const allPorts = nodeGroup.querySelectorAll('.cwl-port');
            console.log(`🔍 Available ports in ${nodeId}:`, Array.from(allPorts).map(p => p.getAttribute('data-port-id')));
            return null;
        }
        
        // Récupérer la position du nœud depuis son transform
        const nodeTransform = nodeGroup.getAttribute('transform');
        const nodeMatches = nodeTransform.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),\s*([^)]+)\)/);
        if (!nodeMatches) {
            console.log(`❌ Could not parse node transform: ${nodeTransform}`);
            return null;
        }
        
        const nodeX = parseFloat(nodeMatches[1]);
        const nodeY = parseFloat(nodeMatches[2]);
        
        // Position relative du port depuis son transform (pas cx/cy)
        let portX = 0, portY = 0;
        const portTransform = port.getAttribute('transform');
        if (portTransform) {
            const portMatches = portTransform.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),\s*([^)]+)\)/);
            if (portMatches) {
                portX = parseFloat(portMatches[1]);
                portY = parseFloat(portMatches[2]);
            }
        }
        
        // Fallback: try cx/cy attributes if transform parsing failed
        if (portX === 0 && portY === 0) {
            const cx = port.getAttribute('cx');
            const cy = port.getAttribute('cy');
            if (cx && cy) {
                portX = parseFloat(cx);
                portY = parseFloat(cy);
            }
        }
        
        // Position absolue du port
        const absoluteX = nodeX + portX;
        const absoluteY = nodeY + portY;
        
        console.log(`✅ Port position found: ${portId} at (${absoluteX}, ${absoluteY}) (node: ${nodeX}, ${nodeY}, port: ${portX}, ${portY})`);
        
        return { x: absoluteX, y: absoluteY };
    }
    
    /**
     * Render nodes (inputs, steps, outputs)
     */
    renderNodes(layout) {
        console.log('🔍 Starting node rendering. Layout nodes:', Object.keys(layout.nodes));
        
        // Render inputs
        Object.values(this.workflow.inputs).forEach(input => {
            console.log(`🔍 Attempting to render input ${input.id}:`, layout.nodes[input.id]);
            if (layout.nodes[input.id]) {
                this.renderNode(input.id, input.label, 'input', layout.nodes[input.id]);
            } else {
                console.log(`❌ No layout position for input ${input.id}`);
            }
        });
        
        // Rendre les steps
        Object.values(this.workflow.steps).forEach(step => {
            console.log(`🔍 Attempting to render step ${step.id}:`, layout.nodes[step.id]);
            if (layout.nodes[step.id]) {
                this.renderNode(step.id, step.label, 'step', layout.nodes[step.id]);
            } else {
                console.log(`❌ No layout position for step ${step.id}`);
            }
        });
        
        // Rendre les outputs
        Object.values(this.workflow.outputs).forEach(output => {
            console.log(`🔍 Attempting to render output ${output.id}:`, layout.nodes[output.id]);
            if (layout.nodes[output.id]) {
                this.renderNode(output.id, output.label, 'output', layout.nodes[output.id]);
            } else {
                console.log(`❌ No layout position for output ${output.id}`);
            }
        });
    }
    
    /**
     * Render an individual node with the Rabix/CWL-SVG styling
     */
    renderNode(id, label, type, position) {
        if (!position || typeof position.x === 'undefined' || typeof position.y === 'undefined') {
            // Create a fallback position instead of aborting
            position = {
                x: 100 + Math.random() * 200,
                y: 100 + Math.random() * 100,
                width: this.options.nodeWidth || 120,
                height: this.options.nodeHeight || 60
            };
        }
        
        // Calculer le nombre de ports pour dimensionner le nœud
        const inputPorts = this.getNodeInputPorts(id);
        const outputPorts = this.getNodeOutputPorts(id);
        const maxPorts = Math.max(inputPorts.length, outputPorts.length);
        
        // Calculer le rayon selon le style cwl-svg original - augmenté pour éviter superposition des labels
        const baseRadius = 35;  // GraphNode.radius augmenté
        const portRadius = 6;   // IOPort.radius augmenté pour plus d'espacement  
        const nodeRadius = baseRadius + maxPorts * portRadius;
        
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'node');
        group.setAttribute('tabindex', '-1');
        group.classList.add(type);
        group.setAttribute('data-connection-id', id);
        group.setAttribute('data-id', id);
        group.setAttribute('transform', `matrix(1, 0, 0, 1, ${position.x}, ${position.y})`);
        
        // Créer le groupe principal (core)
        const coreGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        coreGroup.setAttribute('class', 'core');
        coreGroup.setAttribute('transform', 'matrix(1, 0, 0, 1, 0, 0)');
        
        // Cercle extérieur (style cwl-svg original)
        const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        outerCircle.setAttribute('cx', '0');
        outerCircle.setAttribute('cy', '0');
        outerCircle.setAttribute('r', nodeRadius.toString());
        outerCircle.setAttribute('class', 'outer');
        
        // Cercle intérieur (style cwl-svg original)  
        const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerCircle.setAttribute('cx', '0');
        innerCircle.setAttribute('cy', '0');
        innerCircle.setAttribute('r', (nodeRadius * 0.75).toString());
        innerCircle.setAttribute('class', 'inner');
        
        // Icône selon le type (style cwl-svg authentique)
        const nodeInfo = this.getNodeInfo(id);
        const iconSvg = this.getNodeIcon(nodeInfo);
        
        coreGroup.appendChild(outerCircle);
        coreGroup.appendChild(innerCircle);
        if (iconSvg) {
            const iconElement = this.createIconElement(iconSvg);
            coreGroup.appendChild(iconElement);
        }
        
        // Label sous le nœud (style cwl-svg original)
        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('transform', `matrix(${this.labelScale || 1},0,0,${this.labelScale || 1},0,${nodeRadius + 30})`);
        labelText.setAttribute('class', 'title label');
        labelText.textContent = label || id;
        
        // Créer les ports avec positionnement cwl-svg authentique
        const ports = this.createNodePortsCWLSVG(id, type, nodeRadius, inputPorts, outputPorts);
        
        // Assembler le nœud
        group.appendChild(coreGroup);
        group.appendChild(labelText);
        ports.forEach(port => group.appendChild(port));
        
        // Gestionnaires d'événements pour l'interaction
        this.setupNodeInteraction(group, id);
        
        this.mainGroup.appendChild(group);
    }
    
    /**
     * Configure l'interaction avec un noeud
     */
    setupNodeInteraction(nodeGroup, nodeId) {
        let isDragging = false;
        let startPos = { x: 0, y: 0 };
        let nodeStartPos = { x: 0, y: 0 };
        
        nodeGroup.addEventListener('mousedown', (e) => {
            // Ne pas démarrer le drag si on clique sur un port
            if (e.target.classList.contains('port-handle') || e.target.closest('.port')) {
                return;
            }
            
            e.stopPropagation();
            isDragging = true;
            startPos = { x: e.clientX, y: e.clientY };
            
            // Pour les nœuds circulaires, récupérer la position depuis transform
            const transform = nodeGroup.getAttribute('transform');
            const matches = transform.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),\s*([^)]+)\)/);
            if (matches) {
                nodeStartPos = {
                    x: parseFloat(matches[1]),
                    y: parseFloat(matches[2])
                };
            }
            
            // Gestion de la sélection
            if (!e.ctrlKey && !e.metaKey) {
                this.clearSelection();
            }
            this.selectNode(nodeId);
            
            // Effet visuel de drag
            nodeGroup.classList.add('dragging');
            nodeGroup.style.cursor = 'grabbing';
            
            // Ajouter les listeners de drag au niveau document
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        
        // Gestion du drag au niveau document pour capturer la souris même hors du nœud
        const handleMouseMove = (e) => {
            if (isDragging) {
                e.preventDefault();
                const dx = e.clientX - startPos.x;
                const dy = e.clientY - startPos.y;
                
                const newX = nodeStartPos.x + dx / (this.zoomLevel || 1);
                const newY = nodeStartPos.y + dy / (this.zoomLevel || 1);
                
                this.moveNode(nodeGroup, newX, newY);
            }
        };
        
        const handleMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                nodeGroup.classList.remove('dragging');
                nodeGroup.style.cursor = 'move';
                
                // Masquer les labels après le drag si la souris n'est plus sur le nœud
                setTimeout(() => {
                    if (!nodeGroup.matches(':hover')) {
                        this.hideNodePortLabels(nodeId);
                    }
                }, 100);
                
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        };
        
        // Affichage des ports au survol du nœud
        nodeGroup.addEventListener('mouseenter', (e) => {
            if (!isDragging) {
                this.showNodePortLabels(nodeGroup, nodeId);
            }
        });
        
        nodeGroup.addEventListener('mouseleave', (e) => {
            // Masquer les labels seulement si on ne drag pas et si on quitte vraiment le nœud
            if (!isDragging && !e.relatedTarget?.closest(`[data-id="${nodeId}"]`)) {
                this.hideNodePortLabels(nodeId);
            }
        });

        nodeGroup.addEventListener('click', (e) => {
            // Vérifier si le clic provient d'un port
            if (e.target.classList.contains('cwl-port')) {
                return; // Ne pas traiter le clic sur le nœud si c'est un port
            }
            
            e.stopPropagation();
            // Afficher les détails des ports pour les steps
            if (this.getNodeType(nodeId) === 'step') {
                this.showStepPortDetails(nodeId);
            }
        });
    }
    
    /**
     * Déplace un noeud circulaire vers une nouvelle position
     */
    moveNode(nodeGroup, x, y) {
        const nodeId = nodeGroup.getAttribute('data-id');
        
        // Mettre à jour le transform du groupe principal
        nodeGroup.setAttribute('transform', `matrix(1, 0, 0, 1, ${x}, ${y})`);
        
        // Les ports et autres éléments suivront automatiquement car ils sont dans le groupe
        
        // Mettre à jour les labels de ports s'ils sont affichés
        this.updatePortLabelsPosition(nodeGroup, nodeId);
        
        // Mettre à jour les connexions qui touchent ce nœud
        this.updateConnectionsForNode(nodeGroup);
    }
    
    /**
     * Met à jour les connexions après déplacement d'un nœud
     */
    updateConnectionsForNode(movedNode) {
        const nodeId = movedNode.getAttribute('data-id');
        if (!nodeId) return;
        
        // Trouver toutes les connexions impliquant ce nœud
        const connections = this.mainGroup.querySelectorAll('.edge');
        
        connections.forEach(edge => {
            const sourceNodeId = edge.getAttribute('data-source-node');
            const destNodeId = edge.getAttribute('data-destination-node');
            
            // Si cette connexion implique le nœud déplacé
            if (sourceNodeId === nodeId || destNodeId === nodeId) {
                const sourcePort = edge.getAttribute('data-source-port');
                const destPort = edge.getAttribute('data-destination-port');
                
                // Recalculer les positions des ports
                let fromPos = this.getPortPosition(sourceNodeId, sourcePort, 'output', null);
                let toPos = this.getPortPosition(destNodeId, destPort, 'input', null);
                
                if (!fromPos || !toPos) {
                    // Fallback vers les bords des nœuds
                    const sourceNode = this.mainGroup.querySelector(`[data-id="${sourceNodeId}"]`);
                    const destNode = this.mainGroup.querySelector(`[data-id="${destNodeId}"]`);
                    
                    if (sourceNode && destNode) {
                        fromPos = this.getNodeEdgePosition(sourceNode, 'right');
                        toPos = this.getNodeEdgePosition(destNode, 'left');
                    }
                }
                
                if (fromPos && toPos) {
                    // Regenerer le chemin de connexion
                    const newPath = this.makeConnectionPath(
                        fromPos.x, fromPos.y, 
                        toPos.x, toPos.y, 
                        'right'
                    );
                    
                    // Mettre à jour les deux paths (outer et inner)
                    const outerPath = edge.querySelector('.sub-edge.outer');
                    const innerPath = edge.querySelector('.sub-edge.inner');
                    
                    if (outerPath) outerPath.setAttribute('d', newPath);
                    if (innerPath) innerPath.setAttribute('d', newPath);
                }
            }
        });
    }
    
    /**
     * Affiche les labels de tous les ports d'un nœud au survol
     */
    showNodePortLabels(nodeGroup, nodeId) {
        // Supprimer les anciens labels
        this.hideNodePortLabels(nodeId);
        
        const ports = nodeGroup.querySelectorAll('.cwl-port');
        
        ports.forEach(port => {
            const portId = port.getAttribute('data-port-id');
            const portType = port.getAttribute('data-port-type');
            
            if (portId) {
                // Récupérer les informations complètes du port depuis le workflow
                let portInfo = { id: portId, name: portId };
                
                if (this.workflow) {
                    // D'abord essayer de récupérer le type depuis les inputs/outputs globaux du workflow
                    if (portType === 'input' && this.workflow.inputs) {
                        const globalInput = this.workflow.inputs[portId];
                        if (globalInput && globalInput.type) {
                            portInfo.type = globalInput.type;
                        }
                    } else if (portType === 'output' && this.workflow.outputs) {
                        const globalOutput = this.workflow.outputs[portId];
                        if (globalOutput && globalOutput.type) {
                            portInfo.type = globalOutput.type;
                        }
                    }
                    
                    // Si pas trouvé dans les inputs/outputs globaux, essayer dans les étapes
                    if (!portInfo.type && this.workflow.steps) {
                        const step = this.workflow.steps[nodeId];
                        if (step) {
                            if (portType === 'input' && step.in) {
                                let inputPort = null;
                                
                                // step.in peut être un tableau ou un objet
                                if (Array.isArray(step.in)) {
                                    inputPort = step.in.find(p => (p.id || p) === portId);
                                } else if (typeof step.in === 'object') {
                                    // Si c'est un objet, chercher par clé
                                    inputPort = step.in[portId];
                                }
                                
                                if (inputPort && inputPort.type) {
                                    portInfo.type = inputPort.type;
                                }
                            } else if (portType === 'output' && step.out) {
                                let outputPort = null;
                                
                                // step.out peut être un tableau ou un objet
                                if (Array.isArray(step.out)) {
                                    outputPort = step.out.find(p => (p.id || p) === portId);
                                } else if (typeof step.out === 'object') {
                                    // Si c'est un objet, chercher par clé
                                    outputPort = step.out[portId];
                                }
                                
                                if (outputPort && outputPort.type) {
                                    portInfo.type = outputPort.type;
                                }
                            }
                        }
                    }
                    
                    // Si toujours pas de type, essayer d'inférer depuis les connexions
                    if (!portInfo.type && this.workflow.steps) {
                        // Pour les ports d'entrée, chercher d'où viennent les données
                        if (portType === 'input') {
                            const step = this.workflow.steps[nodeId];
                            if (step && step.in) {
                                let connectionSource = null;
                                
                                if (Array.isArray(step.in)) {
                                    const connection = step.in.find(p => (p.id || p) === portId);
                                    connectionSource = connection ? connection.source || connection : null;
                                } else if (typeof step.in === 'object') {
                                    connectionSource = step.in[portId];
                                }
                                
                                // Si la connexion pointe vers un input global, récupérer son type
                                if (typeof connectionSource === 'string' && this.workflow.inputs) {
                                    const globalInput = this.workflow.inputs[connectionSource];
                                    if (globalInput && globalInput.type) {
                                        portInfo.type = globalInput.type;
                                    }
                                }
                            }
                        }
                    }
                    
                    // En dernier recours, essayer d'inférer le type depuis le nom
                    if (!portInfo.type) {
                        const inferredType = this.inferPortType(portId);
                        if (inferredType) {
                            portInfo.type = inferredType;
                        }
                    }
                    
                    // Debug: log pour voir ce qu'on trouve
                    console.log(`Port ${portId} (${portType}):`, portInfo);
                }
                
                this.showPortLabel(port, portInfo, portType);
            }
        });
    }
    
    /**
     * Masque tous les labels de ports d'un nœud
     */
    hideNodePortLabels(nodeId) {
        const labels = this.mainGroup.querySelectorAll(`.port-label[data-node-id="${nodeId}"]`);
        labels.forEach(label => label.remove());
    }

    /**
     * Met à jour la position des labels de ports pendant le déplacement
     */
    updatePortLabelsPosition(nodeGroup, nodeId) {
        const labels = this.mainGroup.querySelectorAll(`.port-label[data-node-id="${nodeId}"]`);
        
        if (labels.length === 0) return; // Pas de labels à mettre à jour
        
        // Obtenir la nouvelle position du nœud
        const nodeTransform = nodeGroup.getAttribute('transform');
        const nodeMatches = nodeTransform.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),\s*([^)]+)\)/);
        if (!nodeMatches) return;
        
        const nodeX = parseFloat(nodeMatches[1]);
        const nodeY = parseFloat(nodeMatches[2]);
        
        // Mettre à jour la position de chaque label existant (plus efficace que recréer)
        labels.forEach(label => {
            const portId = label.getAttribute('data-port-id');
            const portType = label.getAttribute('data-port-type');
            
            if (portId && portType) {
                // Trouver le port correspondant dans le nœud
                const port = nodeGroup.querySelector(`.cwl-port[data-port-id="${portId}"]`);
                if (port) {
                    const portCx = parseFloat(port.getAttribute('cx'));
                    const portCy = parseFloat(port.getAttribute('cy'));
                    
                    const absoluteX = nodeX + portCx;
                    const absoluteY = nodeY + portCy;
                    
                    // Calculer la nouvelle position du label
                    const allPortsOfType = nodeGroup.querySelectorAll(`[data-port-type="${portType}"]`);
                    
                    // Récupérer le texte réel du label (qui peut inclure le type)
                    const labelTextElement = label.querySelector('text');
                    const actualText = labelTextElement ? labelTextElement.textContent : portId;
                    const textWidth = actualText.length * 7;
                    const padding = 4; // Padding réduit pour correspondre à showPortLabel
                    const rectWidth = textWidth + padding;
                    
                    // Vérifier si le label a une icône
                    const hasIcon = label.querySelector('.port-type-icon') !== null;
                    const iconWidth = hasIcon ? 16 : 0;
                    const totalWidth = rectWidth + iconWidth;
                    
                    // Obtenir les limites du SVG pour éviter les débordements
                    const svgBounds = this.svg.getBoundingClientRect();
                    const viewBox = this.svg.getAttribute('viewBox').split(' ');
                    const svgWidth = parseFloat(viewBox[2]);
                    const svgHeight = parseFloat(viewBox[3]);
                    
                    let rectX, textX, iconX;
                    if (portType === 'input') {
                        rectX = absoluteX - totalWidth - 8; // Espacement augmenté pour correspondre à showPortLabel
                        
                        // Empêcher le débordement à gauche
                        if (rectX < 10) {
                            rectX = 10;
                        }
                        
                        if (hasIcon) {
                            iconX = rectX + 2;
                            textX = rectX + padding/2 + iconWidth;
                        } else {
                            textX = rectX + padding/2;
                        }
                    } else {
                        rectX = absoluteX + 8; // Espacement augmenté pour correspondre à showPortLabel
                        
                        // Empêcher le débordement à droite
                        if (rectX + totalWidth > svgWidth - 10) {
                            rectX = svgWidth - totalWidth - 10;
                        }
                        
                        textX = rectX + padding/2;
                        if (hasIcon) {
                            iconX = rectX + rectWidth + 2;
                        }
                    }
                    
                    // Mettre à jour directement les éléments existants
                    const labelBg = label.querySelector('rect');
                    const labelText = label.querySelector('text');
                    const iconElement = label.querySelector('g');
                    
                    if (labelBg && labelText) {
                        labelBg.setAttribute('x', rectX);
                        labelBg.setAttribute('y', absoluteY - 8); // Position ajustée pour être moins haute
                        labelBg.setAttribute('width', totalWidth); // Largeur mise à jour pour inclure l'icône
                        labelBg.setAttribute('height', 16); // Hauteur réduite pour correspondre à showPortLabel
                        labelText.setAttribute('x', textX);
                        labelText.setAttribute('y', absoluteY + 3); // Position ajustée avec la nouvelle hauteur
                        
                        // Mettre à jour la position de l'icône si elle existe
                        if (iconElement && hasIcon) {
                            iconElement.setAttribute('transform', `translate(${iconX}, ${absoluteY - 6})`);
                        }
                    }
                }
            }
        });
    }

    /**
     * Calcule la position du bord d'un nœud circulaire
     */
    getNodeEdgePosition(nodeGroup, side) {
        const transform = nodeGroup.getAttribute('transform');
        const matches = transform.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),\s*([^)]+)\)/);
        
        if (!matches) return null;
        
        const nodeX = parseFloat(matches[1]);
        const nodeY = parseFloat(matches[2]);
        
        // Calculer le rayon réel du nœud basé sur ses ports (comme dans createNodeCWLSVG)
        const nodeId = nodeGroup.getAttribute('data-id');
        const inputPorts = this.getNodeInputPorts(nodeId);
        const outputPorts = this.getNodeOutputPorts(nodeId);
        const maxPorts = Math.max(inputPorts.length, outputPorts.length);
        const radius = 35 + maxPorts * 6; // Même formule que createNodeCWLSVG
        
        switch (side) {
            case 'right':
                return { x: nodeX + radius, y: nodeY };
            case 'left':
                return { x: nodeX - radius, y: nodeY };
            case 'top':
                return { x: nodeX, y: nodeY - radius };
            case 'bottom':
                return { x: nodeX, y: nodeY + radius };
            default:
                return { x: nodeX, y: nodeY };
        }
    }
    
    /**
     * Redessine toutes les connexions (authentique cwl-svg)
     */
    redrawConnections() {
        // Supprimer les anciennes connexions avec classes authentiques
        const connections = this.mainGroup.querySelectorAll('.edge');
        connections.forEach(conn => conn.remove());
        
        // Recalculer les positions actuelles des nœuds circulaires
        const currentLayout = { nodes: {} };
        this.mainGroup.querySelectorAll('.node').forEach(node => {
            const id = node.getAttribute('data-id');
            const transform = node.getAttribute('transform');
            
            // Parser la transformation matrix pour obtenir x,y
            const matrixMatch = transform.match(/matrix\(1,\s*0,\s*0,\s*1,\s*([^,]+),\s*([^)]+)\)/);
            if (matrixMatch) {
                currentLayout.nodes[id] = {
                    x: parseFloat(matrixMatch[1]),
                    y: parseFloat(matrixMatch[2]),
                    width: 60, // Approximation pour nœud circulaire
                    height: 60
                };
            }
        });
        
        // Redessiner les connexions
        this.renderConnections(currentLayout);
    }
    
    /**
     * Gestion de la sélection des noeuds
     */
    selectNode(nodeId) {
        this.selectedNodes.add(nodeId);
        const nodeGroup = this.mainGroup.querySelector(`[data-id="${nodeId}"]`);
        if (nodeGroup) {
            nodeGroup.classList.add('selected');
        }
        // Mettre en évidence les connexions liées
        this.highlightConnections(nodeId);
    }
    
    clearSelection() {
        this.selectedNodes.clear();
        this.mainGroup.querySelectorAll('.cwl-node.selected').forEach(node => {
            node.classList.remove('selected');
        });
        // Effacer la mise en évidence des connexions
        this.clearConnectionHighlights();
    }

    /**
     * Met en évidence les connexions liées au noeud sélectionné
     */
    highlightConnections(nodeId) {
        // Effacer les anciennes mises en évidence
        this.clearConnectionHighlights();
        
        const connections = this.mainGroup.querySelectorAll('.cwl-connection');
        const relatedConnections = new Set();
        
        // Trouver toutes les connexions liées au noeud
        this.workflow.connections.forEach((conn, index) => {
            if (conn.from.id === nodeId || conn.to.id === nodeId) {
                relatedConnections.add(index);
            }
        });
        
        // Appliquer la mise en évidence
        connections.forEach((connection, index) => {
            if (relatedConnections.has(index)) {
                connection.classList.add('highlighted');
            } else {
                connection.classList.add('dimmed');
            }
        });
    }

    /**
     * Efface la mise en évidence des connexions
     */
    clearConnectionHighlights() {
        this.mainGroup.querySelectorAll('.cwl-connection').forEach(connection => {
            connection.classList.remove('highlighted', 'dimmed');
        });
    }

    /**
     * Supprime tous les panneaux de détails des ports
     */
    clearPortDetails() {
        const existingPanels = this.mainGroup.querySelectorAll('.port-details-panel');
        existingPanels.forEach(panel => panel.remove());
    }

    /**
     * Affiche les détails des ports d'une étape (version pour les nœuds complets)
     */
    showStepPortDetails(stepId) {
        // Supprimer les anciens détails
        this.clearPortDetails();
        
        const step = this.workflow.steps[stepId];
        if (!step) return;
        
        // Créer le panneau de détails
        const detailsPanel = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        detailsPanel.setAttribute('class', 'port-details-panel');
        detailsPanel.setAttribute('data-step-id', stepId);
        
        // Position du panneau près du nœud
        const stepNode = this.mainGroup.querySelector(`[data-id="${stepId}"]`);
        if (!stepNode) {
            console.error('Step node not found:', stepId);
            return;
        }
        
        // Pour les nœuds circulaires, utiliser la position du transform
        const transform = stepNode.getAttribute('transform');
        if (!transform) {
            console.error('Step transform not found for node:', stepId);
            return;
        }
        
        // Extraire x,y du transform matrix(1, 0, 0, 1, x, y)
        const matches = transform.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),\s*([^)]+)\)/);
        if (!matches) {
            console.error('Could not parse transform for node:', stepId);
            return;
        }
        
        const stepX = parseFloat(matches[1]);
        const stepY = parseFloat(matches[2]);
        const stepWidth = 60; // Largeur approximative du cercle pour positionner le panneau
        
        // Fond du panneau
        const panelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const panelWidth = 200;
        const panelHeight = this.calculatePanelHeight(stepId);
        
        panelBg.setAttribute('x', stepX + stepWidth + 20);
        panelBg.setAttribute('y', stepY);
        panelBg.setAttribute('width', panelWidth);
        panelBg.setAttribute('height', panelHeight);
        panelBg.setAttribute('fill', '#ffffff');
        panelBg.setAttribute('stroke', '#e5e7eb');
        panelBg.setAttribute('stroke-width', '1');
        panelBg.setAttribute('rx', '8');
        panelBg.setAttribute('filter', 'drop-shadow(2px 2px 8px rgba(0,0,0,0.1))');
        
        detailsPanel.appendChild(panelBg);
        
        // Titre du panneau
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', stepX + stepWidth + 30);
        title.setAttribute('y', stepY + 20);
        title.setAttribute('fill', '#1f2937');
        title.setAttribute('font-size', '14');
        title.setAttribute('font-weight', 'bold');
        title.textContent = `Ports: ${step.label || stepId}`;
        
        detailsPanel.appendChild(title);
        
        // Détails des ports d'entrée
        const inputPorts = this.getNodeInputPorts(stepId);
        let currentY = stepY + 40;
        
        if (inputPorts.length > 0) {
            const inputTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            inputTitle.setAttribute('x', stepX + stepWidth + 35);
            inputTitle.setAttribute('y', currentY);
            inputTitle.setAttribute('fill', '#4b5563');
            inputTitle.setAttribute('font-size', '12');
            inputTitle.setAttribute('font-weight', '600');
            inputTitle.textContent = 'Inputs:';
            
            detailsPanel.appendChild(inputTitle);
            currentY += 20;
            
            inputPorts.forEach(port => {
                const portText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                portText.setAttribute('x', stepX + stepWidth + 45);
                portText.setAttribute('y', currentY);
                portText.setAttribute('fill', '#6b7280');
                portText.setAttribute('font-size', '11');
                portText.textContent = `${port.name}: ${port.type}`;
                
                // Color type indicator
                const typeIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                typeIndicator.setAttribute('cx', stepX + stepWidth + 40);
                typeIndicator.setAttribute('cy', currentY - 4);
                typeIndicator.setAttribute('r', '3');
                typeIndicator.setAttribute('fill', this.getPortColor(port.type));
                
                detailsPanel.appendChild(typeIndicator);
                detailsPanel.appendChild(portText);
                currentY += 18;
            });
        }
        
        // Output ports details
        const outputPorts = this.getNodeOutputPorts(stepId);
        if (outputPorts.length > 0) {
            currentY += 10;
            const outputTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            outputTitle.setAttribute('x', stepX + stepWidth + 35);
            outputTitle.setAttribute('y', currentY);
            outputTitle.setAttribute('fill', '#4b5563');
            outputTitle.setAttribute('font-size', '12');
            outputTitle.setAttribute('font-weight', '600');
            outputTitle.textContent = 'Outputs:';
            
            detailsPanel.appendChild(outputTitle);
            currentY += 20;
            
            outputPorts.forEach(port => {
                const portText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                portText.setAttribute('x', stepX + stepWidth + 45);
                portText.setAttribute('y', currentY);
                portText.setAttribute('fill', '#6b7280');
                portText.setAttribute('font-size', '11');
                portText.textContent = `${port.name}: ${port.type}`;
                
                // Colorier l'indicateur de type
                const typeIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                typeIndicator.setAttribute('cx', stepX + stepWidth + 40);
                typeIndicator.setAttribute('cy', currentY - 4);
                typeIndicator.setAttribute('r', '3');
                typeIndicator.setAttribute('fill', this.getPortColor(port.type));
                
                detailsPanel.appendChild(typeIndicator);
                detailsPanel.appendChild(portText);
                currentY += 18;
            });
        }
        
        // Bouton de fermeture
        const closeBtn = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        closeBtn.setAttribute('cx', stepX + stepWidth + panelWidth + 10);
        closeBtn.setAttribute('cy', stepY + 10);
        closeBtn.setAttribute('r', '8');
        closeBtn.setAttribute('fill', '#ef4444');
        closeBtn.setAttribute('cursor', 'pointer');
        
        const closeX = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        closeX.setAttribute('x', stepX + stepWidth + panelWidth + 10);
        closeX.setAttribute('y', stepY + 14);
        closeX.setAttribute('fill', '#ffffff');
        closeX.setAttribute('font-size', '12');
        closeX.setAttribute('text-anchor', 'middle');
        closeX.setAttribute('cursor', 'pointer');
        closeX.textContent = '×';
        
        closeBtn.addEventListener('click', () => this.clearPortDetails());
        closeX.addEventListener('click', () => this.clearPortDetails());
        
        detailsPanel.appendChild(closeBtn);
        detailsPanel.appendChild(closeX);
        
        this.mainGroup.appendChild(detailsPanel);
    }

    /**
     * Calcule la hauteur nécessaire pour le panneau de détails
     */
    calculatePanelHeight(stepId) {
        const inputCount = this.getNodeInputPorts(stepId).length;
        const outputCount = this.getNodeOutputPorts(stepId).length;
        
        let height = 50; // Titre + marges
        if (inputCount > 0) height += 30 + inputCount * 18;
        if (outputCount > 0) height += 40 + outputCount * 18;
        
        return Math.max(80, height);
    }

    /**
     * Supprime les panneaux de détails des ports
     */
    clearPortDetails() {
        this.mainGroup.querySelectorAll('.port-details-panel').forEach(panel => {
            panel.remove();
        });
    }
    
    /**
     * Utilitaires
     */
    truncateLabel(label, maxLength) {
        if (label.length <= maxLength) return label;
        return label.substring(0, maxLength - 3) + '...';
    }
    
    zoom(factor) {
        this.zoomLevel *= factor;
        this.zoomLevel = Math.max(0.1, Math.min(5, this.zoomLevel));
        this.updateTransform();
    }
    
    resetView() {
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateTransform();
        this.fitToContent();
    }

    /**
     * Réorganise automatiquement le layout
     */
    autoLayout() {
        if (!this.workflow) return;
        
        const layout = this.calculateLayout();
        
        // Animer le déplacement des noeuds
        this.mainGroup.querySelectorAll('.cwl-node').forEach(node => {
            const id = node.getAttribute('data-id');
            const targetPos = layout.nodes[id];
            
            if (targetPos) {
                // Animation CSS pour un déplacement fluide
                node.style.transition = 'all 0.5s ease-in-out';
                this.moveNode(node, targetPos.x, targetPos.y);
                
                // Retirer la transition après animation
                setTimeout(() => {
                    node.style.transition = '';
                }, 500);
            }
        });
        
        // Ajuster la vue après réorganisation
        setTimeout(() => {
            this.fitToContent();
        }, 600);
    }
    
    updateTransform() {
        this.mainGroup.setAttribute('transform', 
            `translate(${this.panX}, ${this.panY}) scale(${this.zoomLevel})`
        );
    }
    
    fitToContent() {
        if (!this.workflow) return;
        
        // Calculer la bounding box du contenu
        const bbox = this.mainGroup.getBBox();
        if (bbox.width === 0 || bbox.height === 0) return;
        
        const padding = 50;
        const scaleX = (this.options.width - padding * 2) / bbox.width;
        const scaleY = (this.options.height - padding * 2) / bbox.height;
        const scale = Math.min(scaleX, scaleY, 1);
        
        this.zoomLevel = scale;
        this.panX = (this.options.width - bbox.width * scale) / 2 - bbox.x * scale;
        this.panY = (this.options.height - bbox.height * scale) / 2 - bbox.y * scale;
        
        this.updateTransform();
    }
    
    /**
     * Télécharge le SVG actuel
     */
    downloadSVG() {
        const svgData = new XMLSerializer().serializeToString(this.svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'workflow.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Export pour utilisation globale
window.CWLSVGCustom = CWLSVGCustom;

console.log('✅ CWL-SVG Custom loaded successfully');