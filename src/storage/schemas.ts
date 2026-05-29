import { z } from 'zod';

export const TypographySettingsSchema = z.object({
  fontFamily: z.string().default('serif'),
  fontSize: z.string().default('normal'),
  lineHeight: z.string().default('comfortable'),
  pageWidth: z.string().default('normal'),
  // Advanced Novel Typography parameters
  textIndent: z.string().default('normal'),
  chicagoStyle: z.boolean().default(false),
  paragraphSpacing: z.string().default('normal'),
  textAlignment: z.enum(['left', 'center', 'right', 'justify']).default('left'),
  sceneDivider: z.enum(['boxes', 'stars', 'lines', 'asterisk']).default('asterisk'),
});

export type TypographySettings = z.infer<typeof TypographySettingsSchema>;

export const ProjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  title: z.string(),
  author: z.string().default(''),
  genre: z.string().optional(),
  pov: z.enum(['first', 'second', 'third-limited', 'third-omniscient']).default('third-limited'),
  tense: z.enum(['past', 'present']).default('past'),
  language: z.string().default('en'),
  targetWordCount: z.number().int().positive().default(50000),
  createdAt: z.string(),
  updatedAt: z.string(),
  activeChapterId: z.string(),
  chapterOrder: z.array(z.string()),
  typography: TypographySettingsSchema,
});

export type Project = z.infer<typeof ProjectSchema>;

export const ChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Chapter = z.infer<typeof ChapterSchema>;

export const RelationshipSchema = z.object({
  with: z.string(),
  kind: z.string(),
  notes: z.string().optional(),
});

export const EvidenceSchema = z.object({
  chapterId: z.string(),
  quote: z.string(),
  addedAt: z.number(),
});

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  role: z.string().optional(),
  age: z.number().int().optional(),
  appearance: z.string().optional(),
  traits: z.array(z.string()).default([]),
  desires: z.array(z.string()).default([]),
  fears: z.array(z.string()).default([]),
  speechPatterns: z.string().optional(),
  relationships: z.array(RelationshipSchema).default([]),
  notes: z.string().optional(),
  evidence: z.array(EvidenceSchema).default([]),
});

export type Character = z.infer<typeof CharacterSchema>;

export const CharactersSchema = z.object({
  schemaVersion: z.literal(1),
  characters: z.array(CharacterSchema).default([]),
});

export type Characters = z.infer<typeof CharactersSchema>;

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  scale: z.enum(['room', 'building', 'district', 'city', 'region', 'world']).default('room'),
  descriptors: z.array(z.string()).default([]),
  significance: z.string().optional(),
  inhabitants: z.array(z.string()).default([]),
  notes: z.string().optional(),
  evidence: z.array(EvidenceSchema).default([]),
});

export type Location = z.infer<typeof LocationSchema>;

export const LocationsSchema = z.object({
  schemaVersion: z.literal(1),
  locations: z.array(LocationSchema).default([]),
});

export type Locations = z.infer<typeof LocationsSchema>;

export const StyleSchema = z.object({
  schemaVersion: z.literal(1),
  rhythm: z.object({
    avgSentenceLengthHint: z.string().optional(),
    paragraphLengthHint: z.string().optional(),
    rhythmNotes: z.string().optional(),
  }).default({}),
  diction: z.object({
    register: z.string().optional(),
    formality: z.enum(['formal', 'neutral', 'casual']).optional(),
    favoredWords: z.array(z.string()).default([]),
    avoidedWords: z.array(z.string()).default([]),
  }).default({
    favoredWords: [],
    avoidedWords: [],
  }),
  dialogue: z.object({
    taggingConvention: z.string().optional(),
    registerNotes: z.string().optional(),
    dialectMarkers: z.array(z.string()).default([]),
  }).default({
    dialectMarkers: [],
  }),
  narrativeRegister: z.object({
    pointOfView: z.enum(['first', 'second', 'third-limited', 'third-omniscient']).default('third-limited'),
    tense: z.enum(['past', 'present']).default('past'),
    interiority: z.enum(['high', 'medium', 'low']).default('medium'),
  }).default({
    pointOfView: 'third-limited',
    tense: 'past',
    interiority: 'medium',
  }),
  sensoryPalette: z.object({
    dominantSenses: z.array(z.enum(['sight', 'sound', 'smell', 'taste', 'touch'])).default([]),
    colorNotes: z.string().optional(),
    soundNotes: z.string().optional(),
  }).default({
    dominantSenses: [],
  }),
  pronounPairs: z.array(z.string()).default([]),
});

export type Style = z.infer<typeof StyleSchema>;

export const SnapshotSchema = z.object({
  id: z.string(),
  chapterId: z.string(),
  type: z.enum(['manual', 'interval', 'pre-restore', 'pre-import']),
  label: z.string().optional(),
  markdown: z.string(),
  contentHash: z.string(),
  createdAt: z.string(),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

export const SnapshotIndexSchema = z.object({
  snapshots: z.array(z.object({
    id: z.string(),
    type: z.enum(['manual', 'interval', 'pre-restore', 'pre-import']),
    label: z.string().optional(),
    createdAt: z.string(),
    byteSize: z.number(),
    contentHash: z.string(),
  })).default([]),
});

export type SnapshotIndex = z.infer<typeof SnapshotIndexSchema>;
