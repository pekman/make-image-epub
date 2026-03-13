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

    converter(datestr: string) {
      const converted = datestr
        .trim()
        .toUpperCase()
        .replace(/\s+/, "T")
        .replace(/\s+([Z+-])/, "$1");
      const re =
        /^\d+(-\d\d(-\d\d(T\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)?)?)?)?$/;
      if (!re.test(converted)) {
        throw new Error("Invalid date");
      }
      return converted;
    },

    help:
      "publication date. Different levels of precision allowed: " +
      "year, month, day, time with or without seconds or time zone. " +
      "Format: yyyy[-mm[-dd[Thh:mm[:ss[.fraction]][Z|±hh:mm]]]] " +
      "(see <https://www.w3.org/TR/NOTE-datetime>). Space is also " +
      'allowed in place of "T". Examples: "2026", "2026-01", ' +
      '"2026-01-01 12:34Z"',
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

type DCMetadataKey = keyof typeof DUBLIN_CORE_METADATA_KEYS;
export type DublinCoreMetadata = Partial<Record<DCMetadataKey, string[]>>;

export const getDublinCoreKeyInfo = (): [string, DCKeyInfo | null][] =>
  Object.entries(DUBLIN_CORE_METADATA_KEYS);

export function* iterDublinCoreMetadata(
  metadata: DublinCoreMetadata,
): Generator<[DCMetadataKey, string]> {
  for (const [key, values] of Object.entries(metadata)) {
    if (values != null && key in DUBLIN_CORE_METADATA_KEYS) {
      for (const value of values) {
        yield [key as DCMetadataKey, value];
      }
    }
  }
}

function dcKeySupportsRole(key: DCMetadataKey) {
  const info: DCKeyInfo | null = DUBLIN_CORE_METADATA_KEYS[key];
  return !!info?.supportsRole;
}

/** Split possible role identifier from Dublin Core metadata value.
 *
 * @returns tuple [ <role or undefined if no role>, <actual value> ]
 */
export function splitRoleAndValue(
  key: DCMetadataKey,
  value: string,
): [string | undefined, string] {
  let role: string | undefined = undefined;
  if (dcKeySupportsRole(key)) {
    // Try to split value to role and actual value. If no role given,
    // role=undefined and value remains the same.
    const m = /^(?:([a-z]{3}|oth\.[a-z_-]+):)?(.*?)$/.exec(value);
    // regexp always matches
    role = m![1];  // may be part of the match
    value = m![2]!;  // always part of the match
  }
  return [role, value];
}

export const TxtCaptionFormatting = {
  flow:
    "Split text into paragraphs. An empty line is considered a " +
    "paragraph break. Other line breaks are not preserved; text " +
    "flows naturally as paragraphs.",

  verbatim:
    "Put text as-is in a <pre> html element. Preserve spaces and " +
    "line breaks. Text is displayed with a monospace font.",

  markdown:
    "Process as Markdown. This may be useful for some simple " +
    "formattings, such as *italic*.",
} as const;

export interface EpubParameters extends DublinCoreMetadata {
  readonly title: string;
  readonly language: string;

  txtFormatting?: keyof typeof TxtCaptionFormatting;
}
