import fs from 'fs';
import path from 'path';
import type {
  KnowledgeBase,
  KnowledgeCrop,
  KnowledgeDisease,
  KnowledgePest,
  KnowledgeDeficiency,
  KnowledgeRemedy,
  KnowledgeGlossaryTerm,
  KnowledgeMetadata,
} from '@/types/knowledge';

/**
 * Loads all knowledge JSON files from the `knowledge/` directory.
 *
 * Reads every JSON file in crops/, diseases/, pests/, deficiencies/
 * and the top-level glossary.json and metadata.json.
 *
 * Designed to be called once at application startup (see KnowledgeCache).
 * Uses `process.cwd()` to resolve the knowledge directory, which works
 * in both development and production Next.js environments.
 *
 * Throws on malformed files so that startup fails fast — silent data
 * loss is worse than a crash during development.
 */
export function loadKnowledge(): KnowledgeBase {
  const basePath = path.join(process.cwd(), 'knowledge');
  const baseExists = fs.existsSync(basePath);
  if (!baseExists) {
    throw new Error(`Knowledge base not found at ${basePath}`);
  }

  const crops = loadFromDirectory<KnowledgeCrop>(path.join(basePath, 'crops'), []);
  const diseases = loadDiseases(path.join(basePath, 'diseases'));
  const pests = loadFromDirectory<KnowledgePest>(path.join(basePath, 'pests'), []);
  const deficiencies = loadFromDirectory<KnowledgeDeficiency>(path.join(basePath, 'deficiencies'), []);
  const remedies = loadFromDirectory<KnowledgeRemedy>(path.join(basePath, 'remedies'), []);

  const glossary = loadGlossary(path.join(basePath, 'glossary.json'));
  const metadata = loadMetadata(path.join(basePath, 'metadata.json'));

  return {
    crops,
    diseases,
    pests,
    deficiencies,
    remedies,
    glossary,
    metadata,
  };
}

/**
 * Reads all `.json` files in a directory and maps them to type `T`.
 */
function loadFromDirectory<T>(dirPath: string, fallback: T[]): T[] {
  try {
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json'));
    return files.map((file) => {
      const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
      return JSON.parse(content) as T;
    });
  } catch {
    return fallback;
  }
}

/**
 * Diseases are organised in subdirectories by crop, e.g.
 * `diseases/maize/northern-leaf-blight.json`
 */
function loadDiseases(baseDir: string): KnowledgeDisease[] {
  try {
    const cropDirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    const diseases: KnowledgeDisease[] = [];
    for (const dir of cropDirs) {
      const dirPath = path.join(baseDir, dir.name);
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
        diseases.push(JSON.parse(content) as KnowledgeDisease);
      }
    }

    const expansions = loadSymptomExpansions();
    for (const disease of diseases) {
      const extra = expansions[disease.id];
      if (extra && extra.length > 0) {
        const seen = new Set(disease.symptoms.map(s => s.toLowerCase()));
        for (const variant of extra) {
          if (!seen.has(variant.toLowerCase())) {
            disease.symptoms.push(variant);
            seen.add(variant.toLowerCase());
          }
        }
      }
    }

    return diseases;
  } catch {
    return [];
  }
}

function loadSymptomExpansions(): Record<string, string[]> {
  const expansionsPath = path.join(process.cwd(), 'knowledge', 'symptom-expansions.json');
  try {
    const content = fs.readFileSync(expansionsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function loadGlossary(filePath: string): KnowledgeGlossaryTerm[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as KnowledgeGlossaryTerm[];
  } catch {
    return [];
  }
}

function loadMetadata(filePath: string): KnowledgeMetadata {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as KnowledgeMetadata;
  } catch {
    return {
      version: '0.0.0',
      lastUpdated: new Date().toISOString(),
      cropCount: 0,
      diseaseCount: 0,
      pestCount: 0,
      deficiencyCount: 0,
      remedyCount: 0,
      glossaryCount: 0,
    };
  }
}
