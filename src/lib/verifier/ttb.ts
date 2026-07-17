// Codified TTB requirements used by the verifier and the UI.
// Sources: 27 CFR Part 16 (health warning) and 27 CFR Parts 4, 5, 7 (labeling).

export const GOVERNMENT_WARNING_EXACT_TEXT =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not " +
  "drink alcoholic beverages during pregnancy because of the risk of birth " +
  "defects. (2) Consumption of alcoholic beverages impairs your ability to " +
  "drive a car or operate machinery, and may cause health problems.";

export const GOVERNMENT_WARNING_HEADER = "GOVERNMENT WARNING:";

export const WARNING_FORMATTING_RULES = [
  'The header "GOVERNMENT WARNING:" must appear in capital letters and in bold type.',
  "The remainder of the statement must not appear in bold type.",
  "The statement must appear as a single continuous paragraph.",
  "The statement must appear separate and apart from all other label information.",
  "Required on all alcohol beverages of 0.5% ABV or greater (27 CFR Part 16).",
] as const;

export type BeverageType = "spirits" | "wine" | "beer";

export const MANDATORY_FIELDS: { key: keyof LabelClaim; label: string; helpText: string }[] = [
  { key: "brandName", label: "Brand Name", helpText: "Name under which the product is marketed." },
  {
    key: "classType",
    label: "Class / Type Designation",
    helpText: "e.g., Kentucky Straight Bourbon Whiskey, India Pale Ale, Cabernet Sauvignon.",
  },
  {
    key: "alcoholContent",
    label: "Alcohol Content",
    helpText: 'e.g., "45% Alc./Vol. (90 Proof)" or "5.2% ABV".',
  },
  { key: "netContents", label: "Net Contents", helpText: 'e.g., "750 mL", "12 FL OZ".' },
  {
    key: "producer",
    label: "Name & Address of Producer / Bottler / Importer",
    helpText: "Identical to the brewer's notice or basic permit.",
  },
  {
    key: "countryOfOrigin",
    label: "Country of Origin (imports only)",
    helpText: 'Required for imported products, e.g., "Product of Scotland".',
  },
];

export interface LabelClaim {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  producer: string;
  countryOfOrigin?: string;
  beverageType?: BeverageType;
}

export const EXAMPLE_CLAIM: LabelClaim = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  producer: "Old Tom Distillery, Bardstown, KY",
  countryOfOrigin: "",
  beverageType: "spirits",
};

export const BEVERAGE_TYPE_LABELS: Record<BeverageType, string> = {
  spirits: "Distilled Spirits",
  wine: "Wine",
  beer: "Beer / Malt Beverage",
};

// Beverage-class-specific labeling rules. These describe *whether* a field is
// mandatory and *how* it may legally be satisfied — they intentionally do not
// encode precise numeric ABV tolerance bands (e.g. the exact +/- percentage
// TTB allows before a mismatch becomes material), since getting a specific
// number wrong in a compliance tool is worse than leaving it to reviewer
// judgment. Precise tolerances should be confirmed with TTB legal/compliance
// before any production use — see REGULATORY_CAVEAT below.
export interface BeverageRule {
  citation: string;
  /** Whether a numeric ABV percentage is mandatory on the label for this class. */
  abvStatementMandatory: boolean;
  /** How the ABV requirement may be satisfied when not a bare percentage. */
  abvGuidance: string;
}

export const BEVERAGE_RULES: Record<BeverageType, BeverageRule> = {
  spirits: {
    citation: "27 CFR Part 5",
    abvStatementMandatory: true,
    abvGuidance:
      "Distilled spirits labels must always state alcohol content as a percentage " +
      "(Alc./Vol.), optionally paired with proof. Treat a missing or unreadable ABV " +
      "statement as a genuine gap, not a class-based exemption.",
  },
  wine: {
    citation: "27 CFR Part 4",
    abvStatementMandatory: false,
    abvGuidance:
      'Wine labels are not always required to state a numeric ABV percentage. A label ' +
      'that instead states a class designation like "Table Wine" or "Light Wine" (which ' +
      'implies an ABV under roughly 14%) may be satisfying the alcohol-content requirement ' +
      "without a bare percentage. If the applicant's claimed alcohol content is a class " +
      "statement rather than a number and the label shows a matching class statement, treat " +
      "that as satisfying the field rather than a mismatch or missing value.",
  },
  beer: {
    citation: "27 CFR Part 7",
    abvStatementMandatory: false,
    abvGuidance:
      "Malt beverage / beer labels are frequently exempt from mandatory federal ABV " +
      "disclosure (state law varies, and federal rules exempt many malt beverages absent " +
      "a health claim). A beer label with no ABV statement at all should generally be " +
      '"missing" with a note explaining the exemption, not automatically a "reject"-driving ' +
      "gap on its own.",
  },
};

export const REGULATORY_CAVEAT =
  "Beverage-class rules above describe *whether and how* alcohol content must be " +
  "disclosed, not exact numeric tolerance bands. TTB allows tolerances that vary by " +
  "beverage class and ABV level; this prototype defers exact tolerance judgment to the " +
  "model/reviewer rather than encoding specific percentages that would need legal " +
  "verification before production use.";
