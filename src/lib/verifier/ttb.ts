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
