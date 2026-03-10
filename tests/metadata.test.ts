import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

import { parseMetadata } from '../composables/utils/metadataParser'

const fixturesDir = path.join(__dirname, "fixtures")
const files = fs.readdirSync(fixturesDir) .filter(file => file.endsWith(".cwl"))

describe("CWL Metadata Patterns", () => {

  files.forEach((file) => {

    it(`should parse ${file} without crashing`, async () => {

      const filePath = path.join(fixturesDir, file)

      const raw = fs.readFileSync(filePath, "utf8")

      const cwl = yaml.load(raw)

      const result = parseMetadata(cwl || {})

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)

    })

  })

})