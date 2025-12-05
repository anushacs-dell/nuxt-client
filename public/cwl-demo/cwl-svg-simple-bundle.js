// Self-executing bundle for CWLSVGCustom
console.log('🚀 Loading simple CWLSVGCustom bundle...');

// Immediate self-execution
(function() {
    'use strict';
    console.log('📦 Starting CWLSVGCustom bundle execution');
    
    try {
        // Check if already available
        if (typeof window.CWLSVGCustom !== 'undefined') {
            console.log('✅ CWLSVGCustom already available');
            return;
        }
        
        // Define CWLSVGCustom directly
        window.CWLSVGCustom = class {
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
                
                this.initializeSVG();
                this.setupEventHandlers();
            }
            
            initializeSVG() {
                console.log('🎨 Initializing CWLSVGCustom SVG interface');
                this.container.innerHTML = '';
                
                // Create the main wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'cwl-svg-wrapper';
                wrapper.style.cssText = `
                    position: relative;
                    width: 100%;
                    height: ${this.options.height}px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #fafafa;
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
                
                const createButton = (text, handler, title = '') => {
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
                    btn.onclick = handler;
                    return btn;
                };
                
                controls.appendChild(createButton('🔍+', () => this.zoom(1.2), 'Zoom in'));
                controls.appendChild(createButton('🔍−', () => this.zoom(0.8), 'Zoom out'));
                controls.appendChild(createButton('🔄', () => this.resetView(), 'Reset view'));
                controls.appendChild(createButton('📐', () => this.autoLayout(), 'Auto-arrange'));
                controls.appendChild(createButton('💾', () => this.downloadSVG(), 'Download SVG'));
                
                // Create the SVG
                this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                this.svg.setAttribute('width', '100%');
                this.svg.setAttribute('height', '100%');
                this.svg.setAttribute('viewBox', `0 0 ${this.options.width} ${this.options.height}`);
                this.svg.style.cursor = 'grab';
                
                this.mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                this.mainGroup.setAttribute('class', 'main-group');
                this.svg.appendChild(this.mainGroup);
                
                // Add styles
                const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                defs.innerHTML = `
                    <style>
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
                        
                        .edge {
                            stroke: #222;
                            stroke-width: 2px;
                            fill: none;
                            pointer-events: none;
                        }
                        
                        .node:hover .outer {
                            stroke: #11a7a7;
                            stroke-width: 3px;
                            filter: drop-shadow(0 0 8px rgba(17, 167, 167, 0.4));
                        }
                    </style>
                `;
                
                this.svg.appendChild(defs);
                wrapper.appendChild(this.svg);
                wrapper.appendChild(controls);
                this.container.appendChild(wrapper);
            }
            
            setupEventHandlers() {
                console.log('🎛️ Configuring event handlers');
                // Basic handlers for zoom, pan, etc.
            }
            
            async loadWorkflow(data, format = 'auto') {
                console.log('📄 Chargement du workflow CWL', { format });
                try {
                    let parsed;
                    
                    if (format === 'auto') {
                        const trimmed = data.trim();
                        format = (trimmed.startsWith('{') || trimmed.startsWith('[')) ? 'json' : 'yaml';
                    }
                    
                    if (format === 'yaml') {
                        if (typeof jsyaml === 'undefined') {
                            throw new Error('js-yaml library not loaded');
                        }
                        parsed = jsyaml.load(data);
                    } else {
                        parsed = JSON.parse(data);
                    }
                    
                    this.workflow = this.processWorkflow(parsed);
                    this.render();
                    
                    return { success: true, workflow: this.workflow };
                } catch (error) {
                    console.error('Erreur lors du parsing CWL:', error);
                    return { success: false, error: error.message };
                }
            }
            
            processWorkflow(data) {
                console.log('⚙️ Traitement du workflow CWL');
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
                        data.inputs.forEach((input, index) => {
                            const id = input.id || `input_${index}`;
                            workflow.inputs[id] = {
                                id: id,
                                type: input.type || 'any',
                                label: input.label || id,
                                doc: input.doc || ''
                            };
                        });
                    } else {
                        Object.entries(data.inputs).forEach(([id, input]) => {
                            workflow.inputs[id] = {
                                id: id,
                                type: input.type || input || 'any',
                                label: input.label || id,
                                doc: input.doc || ''
                            };
                        });
                    }
                }
                
                // Traiter les steps
                if (data.steps) {
                    if (Array.isArray(data.steps)) {
                        data.steps.forEach((step, index) => {
                            const id = step.id || `step_${index}`;
                            workflow.steps[id] = {
                                id: id,
                                label: step.label || id,
                                run: step.run,
                                in: step.in || {},
                                out: step.out || []
                            };
                        });
                    } else {
                        Object.entries(data.steps).forEach(([id, step]) => {
                            workflow.steps[id] = {
                                id: id,
                                label: step.label || id,
                                run: step.run,
                                in: step.in || {},
                                out: step.out || []
                            };
                        });
                    }
                }
                
                // Traiter les outputs  
                if (data.outputs) {
                    if (Array.isArray(data.outputs)) {
                        data.outputs.forEach((output, index) => {
                            const id = output.id || `output_${index}`;
                            workflow.outputs[id] = {
                                id: id,
                                type: output.type || 'any',
                                label: output.label || id,
                                outputSource: output.outputSource
                            };
                        });
                    } else {
                        Object.entries(data.outputs).forEach(([id, output]) => {
                            workflow.outputs[id] = {
                                id: id,
                                type: output.type || output || 'any',
                                label: output.label || id,
                                outputSource: output.outputSource
                            };
                        });
                    }
                }
                
                return workflow;
            }
            
            render() {
                console.log('🎨 Rendering CWL workflow with authentic cwl-svg style');
                if (!this.workflow) return;
                
                this.mainGroup.innerHTML = '';
                
                // Create a simple visualization for testing
                const inputCount = Object.keys(this.workflow.inputs).length;
                const stepCount = Object.keys(this.workflow.steps).length;
                const outputCount = Object.keys(this.workflow.outputs).length;
                
                let y = 100;
                const spacing = 150;
                
                // Render inputs
                Object.values(this.workflow.inputs).forEach((input, index) => {
                    this.renderNode(input.id, input.label || input.id, 'input', {
                        x: 100,
                        y: y + index * spacing
                    });
                });
                
                // Render steps
                Object.values(this.workflow.steps).forEach((step, index) => {
                    this.renderNode(step.id, step.label || step.id, 'step', {
                        x: 300,
                        y: y + index * spacing
                    });
                });
                
                // Render outputs
                Object.values(this.workflow.outputs).forEach((output, index) => {
                    this.renderNode(output.id, output.label || output.id, 'output', {
                        x: 500,
                        y: y + index * spacing
                    });
                });
            }
            
            renderNode(id, label, type, position) {
                const radius = 30;
                
                // Create the node group
                const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                nodeGroup.setAttribute('class', 'node');
                nodeGroup.classList.add(type);
                nodeGroup.setAttribute('data-id', id);
                nodeGroup.setAttribute('transform', `translate(${position.x}, ${position.y})`);
                
                // Outer circle
                const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                outerCircle.setAttribute('cx', '0');
                outerCircle.setAttribute('cy', '0');
                outerCircle.setAttribute('r', radius.toString());
                outerCircle.setAttribute('class', 'outer');
                
                // Inner circle
                const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                innerCircle.setAttribute('cx', '0');
                innerCircle.setAttribute('cy', '0');
                innerCircle.setAttribute('r', (radius * 0.75).toString());
                innerCircle.setAttribute('class', 'inner');
                
                // Label
                const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                labelText.setAttribute('x', '0');
                labelText.setAttribute('y', radius + 20);
                labelText.setAttribute('class', 'label');
                labelText.textContent = label;
                
                nodeGroup.appendChild(outerCircle);
                nodeGroup.appendChild(innerCircle);
                nodeGroup.appendChild(labelText);
                
                this.mainGroup.appendChild(nodeGroup);
            }
            
            // Utility methods
            zoom(factor) { console.log('🔍 Zoom:', factor); }
            resetView() { console.log('🔄 Reset view'); }
            autoLayout() { console.log('📐 Auto layout'); }
            downloadSVG() { console.log('💾 Download SVG'); }
        };
        
        console.log('✅ CWLSVGCustom defined successfully');
        console.log('📋 Type:', typeof window.CWLSVGCustom);
        
        // Success signal
        window.CWLSVGCustomReady = true;
        
    // Trigger a custom event
        if (typeof window.dispatchEvent === 'function') {
            const event = new CustomEvent('CWLSVGCustomReady', {
                detail: { ready: true }
            });
            window.dispatchEvent(event);
        }
        
    } catch (error) {
        console.error('❌ Error initializing CWLSVGCustom:', error);
        window.CWLSVGCustomError = error;
    }
})();

console.log('🏁 Simple CWLSVGCustom bundle completed');