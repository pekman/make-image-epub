interface DCKeyInfo {
  supportsRole?: boolean;
  noMultiple?: true;
  converter?: (val: string) => string;
  help?: string,
}

export const DUBLIN_CORE_METADATA_KEYS = {
  // most important first
  creator: { supportsRole: true },
  date: {
    noMultiple: true,
    // TODO: validate
    converter: (val: string) => val.trim().toUpperCase().replace(" ", "T"),
    help:
      "publication time. Different granularities allowed: year, " +
      "month, day, time with or without seconds or time zone. " +
      "Format: yyyy[-mm[-dd[Thh:mm[:ss[.fraction]][Z|±hh:mm]]]] " +
      "(see <https://www.w3.org/TR/NOTE-datetime>). Space is also " +
      "allowed in place of 'T'. Examples: '2026', '2026-01', " +
      "'2026-01-01 12:34Z'",
  },

  // then in alphabetical order
  contributor: { supportsRole: true },
  coverage: null,
  description: null,
  format: null,
  publisher: { supportsRole: true },
  relation: null,
  rights: null,
  source: null,
  subject: null,
  type: null,
} as const satisfies Record<string, DCKeyInfo | null>;

export type DublinCoreMetadata = Partial<Record<
  keyof typeof DUBLIN_CORE_METADATA_KEYS,
  string[]
>>;

export const getDublinCoreKeyInfo = (): [string, DCKeyInfo | null][] =>
  Object.entries(DUBLIN_CORE_METADATA_KEYS);

export function* iterDublinCoreMetadata(
  metadata: DublinCoreMetadata,
): Generator<[string, string]> {
  for (const [key, values] of Object.entries(metadata)) {
    if (values != null && key in DUBLIN_CORE_METADATA_KEYS) {
      for (const value of values) {
        yield [key, value];
      }
    }
  }
}

export interface EpubParameters extends DublinCoreMetadata {
  readonly title: string;
  readonly language: string;
}
