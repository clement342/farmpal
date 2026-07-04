import { connectToDatabase } from './connection';
import { CropModel } from './models/crop.model';
import { DiseaseModel } from './models/disease.model';

/**
 * Seed data for the FarmPal knowledge base.
 *
 * Populates the crops and diseases collections only if they are empty.
 * Safe to call on every server start — seeding is idempotent.
 *
 * TODO:
 * - Move seed data to JSON or YAML files for easier editing by domain experts.
 * - Add region-specific crop and disease variants.
 * - Add image URLs for visual identification.
 */

const SEED_CROPS = [
  {
    name: 'Maize',
    scientificName: 'Zea mays',
    varieties: ['Drought-tolerant', 'Quality Protein Maize', 'Hybrid'],
    regions: ['East Africa', 'West Africa', 'Southern Africa', 'Central America'],
    growthStages: ['Germination', 'Vegetative', 'Tasseling', 'Silking', 'Grain fill', 'Maturity'],
    commonDiseaseIds: [],
  },
  {
    name: 'Cassava',
    scientificName: 'Manihot esculenta',
    varieties: ['Sweet', 'Bitter', 'Improved'],
    regions: ['West Africa', 'East Africa', 'Central Africa', 'Southeast Asia'],
    growthStages: ['Planting', 'Sprouting', 'Vegetative', 'Root bulking', 'Maturity'],
    commonDiseaseIds: [],
  },
  {
    name: 'Rice',
    scientificName: 'Oryza sativa',
    varieties: ['Upland', 'Lowland', 'NERICA', 'Aromatic'],
    regions: ['West Africa', 'East Africa', 'South Asia', 'Southeast Asia'],
    growthStages: ['Nursery', 'Transplanting', 'Tillering', 'Panicle initiation', 'Flowering', 'Grain filling', 'Maturity'],
    commonDiseaseIds: [],
  },
  {
    name: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    varieties: ['Roma', 'Cherry', 'Beefsteak', 'Plum'],
    regions: ['East Africa', 'West Africa', 'Southern Africa', 'Mediterranean'],
    growthStages: ['Seedling', 'Vegetative', 'Flowering', 'Fruit set', 'Ripening'],
    commonDiseaseIds: [],
  },
  {
    name: 'Pepper',
    scientificName: 'Capsicum annuum',
    varieties: ['Bell', 'Habanero', 'Bird\'s eye', 'Cayenne'],
    regions: ['West Africa', 'East Africa', 'Central America', 'Southeast Asia'],
    growthStages: ['Seedling', 'Vegetative', 'Flowering', 'Fruit development', 'Ripening'],
    commonDiseaseIds: [],
  },
  {
    name: 'Beans',
    scientificName: 'Phaseolus vulgaris',
    varieties: ['Common', 'Climbing', 'Bush', 'Snap'],
    regions: ['East Africa', 'Central Africa', 'Southern Africa', 'Central America'],
    growthStages: ['Germination', 'Vegetative', 'Flowering', 'Pod formation', 'Maturity'],
    commonDiseaseIds: [],
  },
  {
    name: 'Yam',
    scientificName: 'Dioscorea spp.',
    varieties: ['White', 'Yellow', 'Water', 'Aerial'],
    regions: ['West Africa', 'Central Africa', 'Caribbean'],
    growthStages: ['Planting', 'Sprouting', 'Vine growth', 'Tuber initiation', 'Tuber bulking', 'Maturity'],
    commonDiseaseIds: [],
  },
];

const SEED_DISEASES = [
  {
    name: 'Fall Armyworm',
    scientificName: 'Spodoptera frugiperda',
    affectedCrops: ['Maize', 'Rice'],
    symptoms: ['Irregular holes in leaves', 'Frass (insect droppings) near leaf whorl', 'Window-pane damage on young leaves', 'Stunted growth'],
    causes: ['Spodoptera frugiperda larvae feeding on leaf tissue', 'Warm and humid conditions favour infestation'],
    severity: 'high' as const,
    treatments: ['Apply neem-based biopesticides', 'Use recommended insecticides for severe infestations', 'Introduce natural predators (parasitic wasps)'],
    prevention: ['Early planting to avoid peak pest season', 'Regular field scouting during vegetative stage', 'Intercropping with repellent plants (e.g., desmodium)'],
    regions: ['East Africa', 'West Africa', 'Southern Africa', 'Central America'],
  },
  {
    name: 'Maize Streak Virus',
    scientificName: 'Maize streak virus (MSV)',
    affectedCrops: ['Maize'],
    symptoms: ['Pale yellow streaks along leaf veins', 'Stunted plant growth', 'Reduced cob size', 'Chlorotic leaves'],
    causes: ['Infection by Maize streak virus', 'Transmitted by leafhopper insects (Cicadulina spp.)'],
    severity: 'high' as const,
    treatments: ['Remove and destroy infected plants', 'Control leafhopper populations with insecticides', 'Use virus-free seeds'],
    prevention: ['Plant resistant maize varieties', 'Early planting to avoid peak leafhopper populations', 'Maintain field hygiene'],
    regions: ['East Africa', 'West Africa', 'Southern Africa'],
  },
  {
    name: 'Cassava Mosaic Disease',
    scientificName: 'Cassava mosaic virus (CMV)',
    affectedCrops: ['Cassava'],
    symptoms: ['Yellow or white mosaic pattern on leaves', 'Leaf distortion and curling', 'Stunted growth', 'Reduced root yield'],
    causes: ['Infection by Cassava mosaic virus', 'Transmitted by whitefly (Bemisia tabaci)'],
    severity: 'high' as const,
    treatments: ['Use certified disease-free cuttings', 'Remove infected plants', 'Control whitefly populations'],
    prevention: ['Plant resistant cassava varieties', 'Roguing infected plants early', 'Avoid planting near infected fields'],
    regions: ['West Africa', 'East Africa', 'Central Africa'],
  },
  {
    name: 'Rice Blast',
    scientificName: 'Magnaporthe oryzae',
    affectedCrops: ['Rice'],
    symptoms: ['Diamond-shaped lesions on leaves', 'White or grey centres with brown borders', 'Neck rot on panicles', 'Poor grain filling'],
    causes: ['Fungal infection by Magnaporthe oryzae', 'High humidity and dense planting favour disease spread'],
    severity: 'high' as const,
    treatments: ['Apply fungicides at first sign of infection', 'Reduce nitrogen fertiliser application', 'Improve field drainage'],
    prevention: ['Plant resistant rice varieties', 'Avoid excessive nitrogen fertilisation', 'Space plants adequately for air circulation'],
    regions: ['West Africa', 'East Africa', 'South Asia', 'Southeast Asia'],
  },
  {
    name: 'Late Blight',
    scientificName: 'Phytophthora infestans',
    affectedCrops: ['Tomato', 'Pepper'],
    symptoms: ['Water-soaked lesions on leaves', 'White fungal growth on underside of leaves', 'Dark brown spots on fruits', 'Rapid wilting'],
    causes: ['Infection by Phytophthora infestans', 'Cool, wet weather promotes rapid spread'],
    severity: 'critical' as const,
    treatments: ['Apply copper-based fungicides immediately', 'Remove and destroy infected plant parts', 'Avoid working in wet fields'],
    prevention: ['Use resistant varieties', 'Ensure proper plant spacing', 'Practice crop rotation with non-solanaceous crops'],
    regions: ['East Africa', 'West Africa', 'Mediterranean'],
  },
  {
    name: 'Common Bacterial Blight',
    scientificName: 'Xanthomonas axonopodis pv. phaseoli',
    affectedCrops: ['Beans'],
    symptoms: ['Water-soaked spots on leaves', 'Yellowing leaf margins', 'Brown lesions on pods', 'Seed discolouration'],
    causes: ['Infection by Xanthomonas bacteria', 'Spread by rain splash and contaminated tools'],
    severity: 'moderate' as const,
    treatments: ['Remove infected plants', 'Apply copper-based bactericides', 'Use pathogen-free seeds'],
    prevention: ['Plant certified disease-free seeds', 'Practice crop rotation', 'Avoid working in wet fields'],
    regions: ['East Africa', 'Central Africa', 'Southern Africa'],
  },
  {
    name: 'Yam Mosaic Virus',
    scientificName: 'Yam mosaic virus (YMV)',
    affectedCrops: ['Yam'],
    symptoms: ['Mosaic pattern on leaves', 'Leaf distortion', 'Reduced tuber size', 'Stunted vines'],
    causes: ['Infection by Yam mosaic virus', 'Transmitted by aphids and infected planting material'],
    severity: 'moderate' as const,
    treatments: ['Use virus-free seed yams', 'Remove infected plants', 'Control aphid populations'],
    prevention: ['Plant certified disease-free seed yams', 'Roguing of infected plants', 'Avoid planting near infected fields'],
    regions: ['West Africa', 'Central Africa'],
  },
  {
    name: 'Nitrogen Deficiency',
    scientificName: '',
    affectedCrops: ['Maize', 'Rice', 'Cassava', 'Tomato', 'Pepper', 'Beans', 'Yam'],
    symptoms: ['Uniform yellowing of older leaves', 'Stunted growth', 'Thin stalks', 'Reduced yield'],
    causes: ['Insufficient nitrogen in soil', 'Leaching due to heavy rainfall', 'Poor soil organic matter'],
    severity: 'moderate' as const,
    treatments: ['Apply nitrogen-rich fertiliser (urea or NPK)', 'Foliar spray with urea solution', 'Incorporate organic manure'],
    prevention: ['Regular soil testing', 'Apply fertiliser based on crop growth stage', 'Use cover crops to fix nitrogen'],
    regions: ['East Africa', 'West Africa', 'Central Africa', 'Southern Africa', 'South Asia', 'Southeast Asia', 'Central America', 'Caribbean', 'Mediterranean'],
  },
];

/**
 * Seeds the database with initial crops and diseases.
 *
 * Only inserts data if the respective collection is empty,
 * making this safe to call repeatedly.
 *
 * @returns An object describing what was seeded
 */
export async function seedDatabase(): Promise<{
  cropsSeeded: number;
  diseasesSeeded: number;
}> {
  await connectToDatabase();

  const existingCropCount = await CropModel.countDocuments().exec();
  const existingDiseaseCount = await DiseaseModel.countDocuments().exec();

  let cropsSeeded = 0;
  let diseasesSeeded = 0;

  if (existingCropCount === 0) {
    const inserted = await CropModel.insertMany(SEED_CROPS);
    cropsSeeded = inserted.length;
    console.log(`[Seed] Inserted ${cropsSeeded} crops`);
  } else {
    console.log(`[Seed] Crops collection already has ${existingCropCount} documents — skipping`);
  }

  if (existingDiseaseCount === 0) {
    const inserted = await DiseaseModel.insertMany(SEED_DISEASES);
    diseasesSeeded = inserted.length;
    console.log(`[Seed] Inserted ${diseasesSeeded} diseases`);
  } else {
    console.log(`[Seed] Diseases collection already has ${existingDiseaseCount} documents — skipping`);
  }

  return { cropsSeeded, diseasesSeeded };
}
