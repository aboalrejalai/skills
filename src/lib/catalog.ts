// Build-time data access. Reads the generated catalog when present, otherwise the fixture,
// so the UI can be developed before `npm run catalog` has run.
import type { Catalog, SkillDetail } from './types';
import fixtureCatalog from '../data/fixture/catalog.json';

const generatedCatalog = import.meta.glob<{ default: Catalog }>('../data/generated/catalog.json', { eager: true });
const generatedDetails = import.meta.glob<{ default: SkillDetail }>('../data/generated/skills/*.json', { eager: true });
const fixtureDetails = import.meta.glob<{ default: SkillDetail }>('../data/fixture/skills/*.json', { eager: true });

const useGenerated = Object.keys(generatedCatalog).length > 0;

export function getCatalog(): Catalog {
  if (useGenerated) return Object.values(generatedCatalog)[0].default;
  return fixtureCatalog as Catalog;
}

export function getSkillDetail(id: string): SkillDetail {
  const modules = useGenerated ? generatedDetails : fixtureDetails;
  const match = Object.entries(modules).find(([file]) => file.endsWith(`/${id}.json`));
  if (!match) throw new Error(`No detail file for skill "${id}"`);
  return match[1].default;
}
