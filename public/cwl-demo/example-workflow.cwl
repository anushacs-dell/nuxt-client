cwlVersion: v1.0
class: Workflow

inputs:
  input_file:
    type: File
    doc: "Fichier d'entrée à traiter"
  
  parameter1:
    type: string
    default: "default_value"
    doc: "Premier paramètre du workflow"

steps:
  step1:
    run: tool1.cwl
    in:
      input: input_file
      param: parameter1
    out: [processed_file]
    
  step2:
    run: tool2.cwl
    in:
      input: step1/processed_file
    out: [final_result, log_file]

outputs:
  result:
    type: File
    outputSource: step2/final_result
    doc: "Résultat final du traitement"
    
  log:
    type: File
    outputSource: step2/log_file
    doc: "Fichier de log du traitement"