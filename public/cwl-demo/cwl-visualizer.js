// CWL Visualizer - JavaScript Application with CWL-SVG Custom
console.log('📜 cwl-visualizer.js loading...');

// Avoid redeclaration if already loaded
if (typeof window.CWLVisualizer === 'undefined') {

class CWLVisualizer {
    constructor() {
        this.currentFile = null;
        this.svgContent = null;
        this.cwlSvgRenderer = null; // Instance CWLSVGCustom
        this.cwlSvgAvailable = false;
        this.cwlSvgSource = 'NONE';
        
        
        // Wait for CWLSVGCustom to load
        this.waitForCwlSvg();
    }
    
    waitForCwlSvg() {
        const checkInterval = setInterval(() => {
            if (this.detectCwlSvgLibrary()) {
                console.log(`✅ CWL-SVG Custom détecté et prêt`);
                clearInterval(checkInterval);
                this.initializeCwlSvg();
            }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!this.cwlSvgAvailable) {
                console.warn('⚠️  Timeout: CWL-SVG Custom not available after 10s, using fallback');
                this.cwlSvgSource = 'FALLBACK';
            }
        }, 10000);
    }
    
    detectCwlSvgLibrary() {
        // Detailed debug of window objects
        console.log('🔍 DEBUG - Available window objects:');
        console.log('CWLComponent:', typeof window.CWLComponent, window.CWLComponent);
        console.log('WorkflowFactory:', typeof window.WorkflowFactory, window.WorkflowFactory);
        console.log('Workflow:', typeof window.Workflow, window.Workflow);
        console.log('CWLSVGCustom:', typeof window.CWLSVGCustom, window.CWLSVGCustom);
        console.log('cwlSvg:', typeof window.cwlSvg, window.cwlSvg);
        
        // List all CWL properties in window
        const cwlKeys = Object.keys(window).filter(key => 
            key.toLowerCase().includes('cwl') || key.toLowerCase().includes('svg')
        );
        console.log('CWL object keys:', cwlKeys.length > 0 ? cwlKeys : 'none');
        console.log('cwlSvgAvailable:', this.cwlSvgAvailable);
        console.log('cwlSvgSource:', this.cwlSvgSource);
        console.log('isCwlSvgReady:', this.isCwlSvgReady());
        
        // Check if CWLSVGCustom is available
        if (typeof window !== 'undefined' && window.CWLSVGCustom) {
            console.log('✅ CWLSVGCustom detected!');
            this.cwlSvgAvailable = true;
            this.cwlSvgSource = 'CUSTOM';
            return true;
        }
        
        console.log('❌ CWLSVGCustom non disponible');
        return false;
    }
    
    isCwlSvgReady() {
        return this.cwlSvgAvailable && 
               typeof window.CWLSVGCustom !== 'undefined' &&
               window.CWLSVGCustom !== null;
    }
    
    initializeCwlSvg() {
        if (!this.cwlSvgAvailable) return;
        
        console.log('✅ CWL-SVG Custom initialized successfully');
        this.updateUIForCwlSvg();
    }
    
    showBasicFallback() {
        const svgContainer = document.getElementById('svg-container');
        const svgContent = document.getElementById('svg-content');
        
        if (svgContent) {
            svgContent.innerHTML = `
                <div class="p-8 text-center bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h3 class="text-lg font-semibold text-yellow-800 mb-4">
                        Compatibility Mode
                    </h3>
                    <p class="text-yellow-700 mb-4">
                        Interactive visualization is not available. 
                        The CWL file has been processed but advanced visualization requires a compatible browser.
                    </p>
                    <div class="text-sm text-yellow-600">
                        <p>Format détecté: ${this.currentFile ? this.currentFile.name : 'CWL'}</p>
                        <p>Source CWL-SVG: ${this.cwlSvgSource}</p>
                    </div>
                </div>
            `;
        }
    }
    
    updateUIForCwlSvg() {
        // Ajouter un indicateur visuel que cwl-svg est disponible
        const header = document.querySelector('header h1');
        if (header && this.cwlSvgAvailable) {
            const badge = document.createElement('span');
            badge.className = 'inline-block bg-green-100 text-green-800 text-xs font-semibold ml-2 px-2.5 py-0.5 rounded';
            badge.textContent = `cwl-svg ${this.cwlSvgSource}`;
            badge.title = 'cwl-svg is available for advanced visualization';
            header.appendChild(badge);
        }
    }



    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        // Validate file type
        const validExtensions = ['.cwl', '.yml', '.yaml'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            this.showError(`Unsupported file type. Please select a ${validExtensions.join(', ')} file`);
            return;
        }

        this.currentFile = file;
        this.showFileInfo(file);
        this.hideError();

        // Read file content
        const reader = new FileReader();
        reader.onload = (e) => {
            // Use modern visualization
            this.generateModernVisualization(e.target.result);
        };
        reader.onerror = () => {
            this.showError('Error reading file');
        };
        reader.readAsText(file);
    }

    showFileInfo(file) {
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-size').textContent = this.formatFileSize(file.size);
        document.getElementById('file-info').classList.remove('hidden');
    }




    async generateVisualization(cwlContent) {
        this.showLoading();
        
        try {
            // Parse CWL content
            let cwlData;
            try {
                // Try JSON first
                cwlData = JSON.parse(cwlContent);
            } catch (e) {
                // If JSON fails, try YAML parsing
                cwlData = this.parseYAML(cwlContent);
            }

            console.log('CWL Data parsed:', cwlData);

            // Use CWLSVGCustom to generate visualization
            await this.generateSVGFromCWLCustom(cwlContent);
            
        } catch (error) {
            console.error('Visualization error:', error);
            this.showError('Error generating visualization: ' + error.message);
            this.hideLoading();
        }
    }

    parseYAML(yamlContent) {
        // Utiliser js-yaml si disponible
        if (typeof jsyaml !== 'undefined') {
            try {
                return jsyaml.load(yamlContent);
            } catch (e) {
                console.warn('Erreur avec js-yaml, utilisation du parser simple:', e);
                return this.parseSimpleYAML(yamlContent);
            }
        } else {
            return this.parseSimpleYAML(yamlContent);
        }
    }

    // Generate visualization with CWLSVGCustom
    async generateSVGFromCWLCustom(cwlContent) {
        try {
            if (!window.CWLSVGCustom) {
                throw new Error('CWLSVGCustom not available');
            }

            // Prepare existing visualization container
            const svgContainer = document.getElementById('svg-container');
            const svgContent = document.getElementById('svg-content');
            
            if (!svgContainer || !svgContent) {
                throw new Error('SVG containers not found in DOM');
            }

            // Clear and prepare container
            svgContent.innerHTML = '';
            
            // Create CWLSVGCustom instance with dynamic dimensions
            const containerRect = svgContainer.getBoundingClientRect();
            this.cwlSvgRenderer = new window.CWLSVGCustom(svgContent, {
                width: Math.max(1200, containerRect.width || 1200),
                height: Math.max(600, containerRect.height || 600)
            });
            
            // Load workflow
            const result = await this.cwlSvgRenderer.loadWorkflow(cwlContent);
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            // Display visualization (no more viz-controls to display)
            svgContainer.classList.remove('hidden');
            
            console.log('✅ CWL visualization generated successfully');
            this.hideLoading();
            
        } catch (error) {
            console.error('Error generating with CWLSVGCustom:', error);
            // Fallback to basic method
            this.showBasicFallback();
            this.hideLoading();
        }
    }

    // Use js-yaml for parsing YAML files
    parseSimpleYAML(yamlContent) {
        if (typeof jsyaml !== 'undefined') {
            try {
                return jsyaml.load(yamlContent);
            } catch (e) {
                console.warn('js-yaml parsing failed, falling back to simple parser:', e);
            }
        }
        
        // Fallback simple parser
        const lines = yamlContent.split('\n');
        const result = {};
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const colonIndex = trimmed.indexOf(':');
                if (colonIndex > 0) {
                    const key = trimmed.substring(0, colonIndex).trim();
                    const value = trimmed.substring(colonIndex + 1).trim();
                    
                    if (value && !value.startsWith('#')) {
                        result[key] = value.replace(/['"]/g, '');
                    }
                }
            }
        }
        
        return result;
    }

    async generateSVGFromCWL(cwlData) {
        // Try to use the real cwl-svg library with all its interactive features
        try {
            // Check if we have the cwl-svg library and cwlts models available
            const hasWorkflow = typeof window !== 'undefined' && window.Workflow;
            const hasWorkflowFactory = typeof window !== 'undefined' && window.WorkflowFactory;
            const hasPlugins = typeof window !== 'undefined' && 
                               window.SVGArrangePlugin && 
                               window.SVGNodeMovePlugin && 
                               window.SVGPortDragPlugin;
            
            if (hasWorkflow && hasWorkflowFactory && hasPlugins) {
                console.log('Using cwl-svg with full interactive capabilities');
                return await this.createInteractiveWorkflow(cwlData);
            }

            // Fallback to older detection methods for other cwl-svg variants
            if (typeof window !== 'undefined' && window.CwlSvg) {
                console.log('Using window.CwlSvg constructor');
                const cwlSvg = new window.CwlSvg({
                    svgId: 'cwl-workflow-svg',
                    workflow: cwlData
                });
                const svgElement = await cwlSvg.generateSVG();
                return svgElement.outerHTML;
            }

            // Method: Check for cwl-svg module functions
            if (typeof window !== 'undefined' && window.cwlSvg) {
                console.log('Using window.cwlSvg module functions');
                const lib = window.cwlSvg;
                
                if (typeof lib.render === 'function') {
                    const result = await lib.render(cwlData);
                    return typeof result === 'string' ? result : result.outerHTML;
                }
                if (typeof lib.generate === 'function') {
                    const result = await lib.generate(cwlData);
                    return typeof result === 'string' ? result : result.outerHTML;
                }
            }

            // Method: Dynamic import fallback
            try {
                const importFunction = new Function('specifier', 'return import(specifier)');
                const cwlSvgModule = await importFunction('cwl-svg');
                console.log('Using dynamic import of cwl-svg');
                
                const CwlSvgClass = cwlSvgModule.default || cwlSvgModule.CwlSvg || cwlSvgModule;
                if (typeof CwlSvgClass === 'function') {
                    const cwlSvg = new CwlSvgClass({
                        svgId: 'cwl-workflow-svg', 
                        workflow: cwlData
                    });
                    const svgElement = await cwlSvg.generateSVG();
                    return svgElement.outerHTML;
                }
            } catch (importError) {
                console.info('Dynamic import not available or failed:', importError.message);
            }

            console.log('cwl-svg not available, using fallback generator');
            
        } catch (error) {
            console.warn('Error trying to use cwl-svg:', error.message);
        }

        // Fallback to custom generator
        return await this.generateFallbackSVG(cwlData);
    }

    async createInteractiveWorkflow(cwlData) {
        try {
            console.log('Creating interactive workflow with cwl-svg');
            
            // Clear any existing workflow
            if (this.workflow) {
                this.workflow.destroy();
                this.workflow = null;
            }

            // Create the model using WorkflowFactory from CWL namespace
            const { WorkflowFactory, Workflow, SVGArrangePlugin, SVGNodeMovePlugin, 
                    SVGPortDragPlugin, SelectionPlugin, SVGEdgeHoverPlugin, ZoomPlugin } = window.CWL;

            // Parse CWL data using WorkflowFactory 
            this.cwlModel = WorkflowFactory.from(cwlData);
            console.log('CWL Model created:', this.cwlModel);

            // Get or create the SVG container
            const container = document.getElementById('visualization-container');
            if (!container) {
                throw new Error('Visualization container not found');
            }

            // Create SVG element for cwl-svg
            let svgElement = container.querySelector('svg.cwl-workflow');
            if (!svgElement) {
                svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svgElement.setAttribute('class', 'cwl-workflow');
                svgElement.style.width = '100%';
                svgElement.style.height = '100%';
                svgElement.style.minHeight = '500px';
                container.innerHTML = '';
                container.appendChild(svgElement);
            }

            // Create the interactive workflow with all plugins
            this.workflow = new Workflow({
                model: this.cwlModel,
                svgRoot: svgElement,
                editingEnabled: true, // Enable interactive editing
                plugins: [
                    new SVGArrangePlugin(),     // Auto-arrange nodes
                    new SVGEdgeHoverPlugin(),   // Edge highlighting on hover
                    new SVGNodeMovePlugin({     // Drag and drop nodes
                        movementSpeed: 10
                    }),
                    new SVGPortDragPlugin(),    // Connect ports by dragging
                    new SelectionPlugin(),      // Select and highlight elements
                    new ZoomPlugin(),           // Zoom and pan functionality
                ]
            });

            console.log('Interactive workflow created successfully');

            // Fit the workflow to viewport and arrange if needed
            setTimeout(() => {
                try {
                    this.workflow.fitToViewport();
                    
                    // Auto-arrange if nodes don't have positions
                    const arrangePlugin = this.workflow.getPlugin(SVGArrangePlugin);
                    if (arrangePlugin) {
                        arrangePlugin.arrange();
                    }
                    
                    console.log('Workflow arranged and fitted to viewport');
                } catch (e) {
                    console.warn('Error arranging workflow:', e);
                }
            }, 100);

            // Setup event listeners for interactive features
            this.setupWorkflowEventListeners();

            // Return a placeholder - the actual SVG is now interactive in the DOM
            return '<div class="interactive-workflow-placeholder">Interactive CWL Workflow loaded successfully!</div>';
            
        } catch (error) {
            console.error('Error creating interactive workflow:', error);
            throw new Error('Failed to create interactive workflow: ' + error.message);
        }
    }

    setupWorkflowEventListeners() {
        if (!this.workflow) return;

        // Listen for selection changes
        const selectionPlugin = this.workflow.getPlugin(window.SelectionPlugin);
        if (selectionPlugin) {
            selectionPlugin.registerOnSelectionChange((selection) => {
                console.log('Selection changed:', selection);
                // Could show selection details in UI here
            });
        }

        // Listen for workflow changes
        this.workflow.on('afterChange', (change) => {
            console.log('Workflow changed:', change);
        });

        // Listen for workflow render events
        this.workflow.on('afterRender', () => {
            console.log('Workflow rendered');
        });
    }

    // New modern method inspired by vue-cwl
    async generateModernVisualization(cwlContent) {
        console.log('🎨 Generating modern visualization...');
        this.showLoading();
        
        try {
            // Parse CWL content
            let cwlData;
            try {
                // Try JSON first
                cwlData = JSON.parse(cwlContent);
            } catch (e) {
                // If JSON fails, try YAML parsing
                cwlData = this.parseYAML(cwlContent);
            }

            console.log('CWL Data parsed:', cwlData);

            // Debug available objects
            console.log('🔍 Debug object state:');
            console.log('- window.CWLComponent:', typeof window.CWLComponent);
            console.log('- window.WorkflowFactory:', typeof window.WorkflowFactory);
            console.log('- window.Workflow:', typeof window.Workflow);
            console.log('- window.CWL:', window.CWL);
            console.log('- cwlSvgAvailable:', this.cwlSvgAvailable);
            console.log('- cwlSvgSource:', this.cwlSvgSource);

            // Also surface debug info into a visible panel for users without devtools
            try {
                const debugPanel = document.getElementById('debug-panel');
                if (debugPanel) {
                    debugPanel.innerText = [
                        `CWLComponent: ${typeof window.CWLComponent}`,
                        `WorkflowFactory: ${window.CWL ? typeof window.CWL.WorkflowFactory : typeof window.WorkflowFactory}`,
                        `Workflow: ${window.CWL ? typeof window.CWL.Workflow : typeof window.Workflow}`,
                        `CWL object keys: ${window.CWL ? Object.keys(window.CWL).join(', ') : 'none'}`,
                        `cwlSvgAvailable: ${this.cwlSvgAvailable}`,
                        `cwlSvgSource: ${this.cwlSvgSource}`,
                        `isCwlSvgReady: ${this.isCwlSvgReady()}`
                    ].join('\n');
                }
            } catch (e) {
                console.warn('Impossible d\'afficher debug dans le panneau:', e);
            }

            // Obtenir le conteneur de visualisation
            const container = document.getElementById('svg-content');
            if (!container) {
                throw new Error('Visualization container not found');
            }

            // Destroy any existing instance
            if (this.cwlComponent) {
                this.cwlComponent.destroy();
            }

            // Check availability of modern CWL component
            if (typeof window.CWLComponent === 'undefined') {
                console.warn('⚠️  CWLComponent not available, using fallback');
                return await this.generateVisualization(cwlContent);
            }

            // Wait for cwl-svg to be fully loaded
            let attempts = 0;
            const maxAttempts = 50; // 5 secondes max
            while (attempts < maxAttempts && !this.isCwlSvgReady()) {
                console.log(`⏳ Waiting for cwl-svg... (${attempts + 1}/${maxAttempts})`);
                console.log('Debug cwl-svg state:', {
                    cwlSvgAvailable: this.cwlSvgAvailable,
                    windowCWL: typeof window.CWL,
                    workflowFactory: window.CWL ? typeof window.CWL.WorkflowFactory : 'no CWL',
                    workflow: window.CWL ? typeof window.CWL.Workflow : 'no CWL'
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!this.isCwlSvgReady()) {
                console.warn('⚠️ cwl-svg not available after waiting, using fallback');
                return await this.generateVisualization(cwlContent);
            }

            // Create new modern CWL component
            this.cwlComponent = new window.CWLComponent({
                container: container,
                cwl: cwlData,
                editingEnabled: true,
                width: '100%',
                height: '600px',
                plugins: this.getModernPlugins(),
                onWorkflowChanged: (workflow) => {
                    console.log('🔄 Workflow changed:', workflow);
                    this.onWorkflowChanged(workflow);
                },
                onSelectionChanged: (selection) => {
                    console.log('🎯 Selection changed:', selection);
                    this.onSelectionChanged(selection);
                },
                onError: (error) => {
                    console.error('❌ CWL Component error:', error);
                    this.showError(`Erreur du composant: ${error.message}`);
                }
            });

            this.hideLoading();
            console.log('✅ Modern visualization generated successfully');
            
        } catch (error) {
            console.error('Visualization error:', error);
            this.showError('Error generating visualization: ' + error.message);
            this.hideLoading();
        }
    }

    getModernPlugins() {
        const plugins = [];
        
        // Plugins cwl-svg si disponibles
        if (typeof window !== 'undefined') {
            if (window.SVGArrangePlugin) plugins.push(window.SVGArrangePlugin);
            if (window.SelectionPlugin) plugins.push(window.SelectionPlugin);
            if (window.SVGNodeMovePlugin) plugins.push(window.SVGNodeMovePlugin);
            if (window.SVGEdgeHoverPlugin) plugins.push(window.SVGEdgeHoverPlugin);
            if (window.SVGPortDragPlugin) plugins.push(window.SVGPortDragPlugin);
            if (window.ZoomPlugin) plugins.push(window.ZoomPlugin);
        }
        
        console.log(`🔌 Plugins modernes chargés: ${plugins.length}`);
        return plugins;
    }

    onWorkflowChanged(workflow) {
        // Callback for workflow changes
        console.log('Workflow updated:', workflow);
        
        // Update interface if needed
        if (workflow && workflow.model) {
            // Display workflow information
            this.updateWorkflowInfo(workflow.model);
        }
    }

    onSelectionChanged(selection) {
        // Callback for selection changes
        console.log('Selection updated:', selection);
        
        // Display selected element details
        if (selection) {
            this.showSelectionDetails(selection);
        }
    }

    updateWorkflowInfo(model) {
        // Update workflow information in interface
        try {
            const info = {
                inputs: Object.keys(model.inputs || {}).length,
                outputs: Object.keys(model.outputs || {}).length,
                steps: Object.keys(model.steps || {}).length
            };
            
            console.log('📊 Workflow info:', info);
            
            // Optional: update UI with this info
            const infoElement = document.getElementById('workflow-info');
            if (infoElement) {
                infoElement.innerHTML = `
                    <div class="text-sm text-gray-600">
                        <span class="mr-4">Inputs: ${info.inputs}</span>
                        <span class="mr-4">Steps: ${info.steps}</span>
                        <span>Outputs: ${info.outputs}</span>
                    </div>
                `;
            }
        } catch (error) {
            console.warn('Error updating workflow info:', error);
        }
    }

    showSelectionDetails(selection) {
        // Display details of selected element
        try {
            console.log('🔍 Selection details:', selection);
            
            // Optional: display in side panel
            const detailsElement = document.getElementById('selection-details');
            if (detailsElement && selection) {
                detailsElement.innerHTML = `
                    <div class="p-4 border rounded-lg">
                        <h4 class="font-semibold text-gray-800">Selected Element</h4>
                        <p class="text-sm text-gray-600">ID: ${selection.id || 'N/A'}</p>
                        <p class="text-sm text-gray-600">Type: ${selection.type || selection.class || 'N/A'}</p>
                    </div>
                `;
            }
        } catch (error) {
            console.warn('Error displaying details:', error);
        }
    }

    async generateFallbackSVG(cwlData) {
        // Simulate asynchronous processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        const workflowClass = cwlData.class || cwlData.cwlVersion || 'Workflow';
        const inputs = cwlData.inputs || {};
        const outputs = cwlData.outputs || {};
        const steps = cwlData.steps || {};

        // Generate custom SVG based on CWL structure
        const svg = this.createWorkflowSVG(workflowClass, inputs, outputs, steps);
        return svg;
    }

    createWorkflowSVG(workflowClass, inputs, outputs, steps) {
        const width = 600;
        const height = 400;
        const padding = 40;

        // Count elements
        const inputCount = Object.keys(inputs).length || 1;
        const outputCount = Object.keys(outputs).length || 1;
        const stepCount = Object.keys(steps).length || 1;

        let svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" fill="#666">
                        <polygon points="0 0, 10 3.5, 0 7" />
                    </marker>
                    <linearGradient id="inputGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:#e3f2fd;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#bbdefb;stop-opacity:1" />
                    </linearGradient>
                    <linearGradient id="stepGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:#f3e5f5;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#e1bee7;stop-opacity:1" />
                    </linearGradient>
                    <linearGradient id="outputGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:#e8f5e8;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#c8e6c9;stop-opacity:1" />
                    </linearGradient>
                </defs>
                
                <!-- Background -->
                <rect width="${width}" height="${height}" fill="#fafafa" stroke="#e0e0e0" stroke-width="1" rx="8"/>
                
                <!-- Title -->
                <text x="${width/2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#333">
                    ${workflowClass}
                </text>
        `;

        // Draw inputs
        const inputY = 80;
        const inputSpacing = Math.min(120, (width - 2 * padding) / Math.max(inputCount, 1));
        
        Object.keys(inputs).forEach((inputName, index) => {
            const x = padding + (index * inputSpacing) + (inputSpacing / 2);
            svg += this.createNode(x, inputY, inputName, 'input', 'url(#inputGradient)');
        });

        if (inputCount === 0) {
            svg += this.createNode(width/2, inputY, 'Input', 'input', 'url(#inputGradient)');
        }

        // Draw steps
        const stepY = 180;
        const stepSpacing = Math.min(140, (width - 2 * padding) / Math.max(stepCount, 1));
        
        Object.keys(steps).forEach((stepName, index) => {
            const x = padding + (index * stepSpacing) + (stepSpacing / 2);
            svg += this.createNode(x, stepY, stepName, 'step', 'url(#stepGradient)');
        });

        if (stepCount === 0) {
            svg += this.createNode(width/2, stepY, 'Process', 'step', 'url(#stepGradient)');
        }

        // Draw outputs
        const outputY = 280;
        const outputSpacing = Math.min(120, (width - 2 * padding) / Math.max(outputCount, 1));
        
        Object.keys(outputs).forEach((outputName, index) => {
            const x = padding + (index * outputSpacing) + (outputSpacing / 2);
            svg += this.createNode(x, outputY, outputName, 'output', 'url(#outputGradient)');
        });

        if (outputCount === 0) {
            svg += this.createNode(width/2, outputY, 'Output', 'output', 'url(#outputGradient)');
        }

        // Draw connections
        svg += this.drawConnections(width, inputY, stepY, outputY, Math.max(inputCount, 1), Math.max(stepCount, 1), Math.max(outputCount, 1));

        // Add workflow info
        svg += `
            <text x="10" y="${height - 20}" font-family="Arial, sans-serif" font-size="10" fill="#666">
                Inputs: ${inputCount} | Steps: ${stepCount} | Outputs: ${outputCount}
            </text>
        `;

        svg += '</svg>';
        return svg;
    }

    createNode(x, y, label, type, fill) {
        const nodeWidth = 100;
        const nodeHeight = 50;
        const truncatedLabel = label.length > 12 ? label.substring(0, 12) + '...' : label;
        
        return `
            <g>
                <rect x="${x - nodeWidth/2}" y="${y - nodeHeight/2}" 
                      width="${nodeWidth}" height="${nodeHeight}" 
                      fill="${fill}" stroke="#666" stroke-width="1.5" rx="8"/>
                <text x="${x}" y="${y + 5}" text-anchor="middle" 
                      font-family="Arial, sans-serif" font-size="11" font-weight="500" fill="#333">
                    ${truncatedLabel}
                </text>
            </g>
        `;
    }

    drawConnections(width, inputY, stepY, outputY, inputCount, stepCount, outputCount) {
        let connections = '';
        
        // Input to steps connections
        for (let i = 0; i < Math.min(inputCount, stepCount); i++) {
            const inputX = 40 + (i * 120) + 60;
            const stepX = 40 + (i * 140) + 70;
            connections += `<path d="M ${inputX} ${inputY + 25} Q ${inputX} ${(inputY + stepY) / 2} ${stepX} ${stepY - 25}" 
                                stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/>`;
        }
        
        // Steps to output connections
        for (let i = 0; i < Math.min(stepCount, outputCount); i++) {
            const stepX = 40 + (i * 140) + 70;
            const outputX = 40 + (i * 120) + 60;
            connections += `<path d="M ${stepX} ${stepY + 25} Q ${stepX} ${(stepY + outputY) / 2} ${outputX} ${outputY - 25}" 
                                stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/>`;
        }
        
        return connections;
    }

    showLoading() {
        document.getElementById('svg-container').classList.add('hidden');
    }


    showVisualization(svg) {
        this.svgContent = svg;
        document.getElementById('svg-container').classList.remove('hidden');
        
        const svgElement = document.getElementById('svg-content');
        svgElement.innerHTML = svg;
        svgElement.style.transformOrigin = 'top left';
        
        this.updateZoomDisplay();
    }

    hideVisualization() {
        const svgContainer = document.getElementById('svg-container');
    
        if (loading) loading.classList.add('hidden');
        if (svgContainer) svgContainer.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
    
        this.svgContent = null;
    }
    


    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the application when DOM is loaded or immediately if already loaded
function initializeCWLVisualizer() {
    console.log('🎯 Initialisation de CWLVisualizer...');
    new CWLVisualizer();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCWLVisualizer);
} else {
    // DOM already loaded, initialize immediately
    initializeCWLVisualizer();
}

// Close condition and export to window
window.CWLVisualizer = CWLVisualizer;

} else {
    console.log('⚠️  CWLVisualizer already declared, using existing instance.');
}