/**
 * CWL Visualizer API - Public API for CWL-SVG Custom
 * Provides public methods to load and visualize CWL workflows programmatically
 */

class CWLVisualizerAPI {
    constructor(visualizer) {
        this.visualizer = visualizer;
    }

    /**
     * Load a CWL workflow from a URL
     * @param {string} url - URL to the CWL file
     * @returns {Promise<void>}
     */
    async loadFromURL(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            return this.loadFromText(text);
        } catch (error) {
            console.error('Error loading CWL from URL:', error);
            throw error;
        }
    }

    /**
     * Load a CWL workflow from a text string
     * @param {string} cwlText - CWL content as text (YAML or JSON)
     * @returns {Promise<void>}
     */
    async loadFromText(cwlText) {
        try {
            let cwlObject;
            
            // Try parsing as JSON first
            try {
                cwlObject = JSON.parse(cwlText);
            } catch (e) {
                // If JSON parsing fails, try YAML
                if (window.jsyaml) {
                    cwlObject = jsyaml.load(cwlText);
                } else {
                    throw new Error('YAML parser not available. Include js-yaml library.');
                }
            }
            
            return this.loadFromObject(cwlObject);
        } catch (error) {
            console.error('Error parsing CWL text:', error);
            throw error;
        }
    }

    /**
     * Load a CWL workflow from a JavaScript object
     * @param {Object} cwlObject - Parsed CWL workflow object
     * @returns {Promise<void>}
     */
    async loadFromObject(cwlObject) {
        try {
            if (!cwlObject) {
                throw new Error('CWL object is null or undefined');
            }

            // Validate that it's a CWL workflow
            if (!cwlObject.class || !cwlObject.cwlVersion) {
                throw new Error('Invalid CWL format: missing class or cwlVersion');
            }

            // Load the workflow
            this.visualizer.loadWorkflow(cwlObject);
            
            return Promise.resolve();
        } catch (error) {
            console.error('Error loading CWL object:', error);
            throw error;
        }
    }

    /**
     * Load from a File object (for file upload)
     * @param {File} file - File object from input element
     * @returns {Promise<void>}
     */
    async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    await this.loadFromText(e.target.result);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * Clear the current visualization
     */
    clear() {
        this.visualizer.workflow = null;
        if (this.visualizer.mainGroup) {
            this.visualizer.mainGroup.innerHTML = '';
        }
    }

    /**
     * Get the current workflow object
     * @returns {Object|null}
     */
    getWorkflow() {
        return this.visualizer.workflow;
    }

    /**
     * Export current visualization as SVG
     * @returns {string} - SVG content as string
     */
    exportSVG() {
        return this.visualizer.svg ? this.visualizer.svg.outerHTML : '';
    }

    /**
     * Download the current visualization as SVG file
     * @param {string} filename - Name for the downloaded file
     */
    downloadSVG(filename = 'cwl-workflow.svg') {
        this.visualizer.downloadSVG(filename);
    }

    /**
     * Zoom in/out
     * @param {number} factor - Zoom factor (>1 = zoom in, <1 = zoom out)
     */
    zoom(factor) {
        this.visualizer.zoom(factor);
    }

    /**
     * Reset view to default
     */
    resetView() {
        this.visualizer.resetView();
    }

    /**
     * Auto-layout the workflow
     */
    autoLayout() {
        this.visualizer.autoLayout();
    }

    /**
     * Fit visualization to content
     */
    fitToContent() {
        this.visualizer.fitToContent();
    }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CWLVisualizerAPI;
}
