export function parseMetadata(cwl: any) {
    try {
      if (!cwl || !Array.isArray(cwl.metadata)) {
        return []
      }
  
      return cwl.metadata.map((m: any) => ({
        role: m?.role ?? null,
        title: m?.title ?? null,
        value: m?.value ?? null
      }))
    } catch (err) {
      console.error("Metadata parsing failed:", err)
      return []
    }
  }