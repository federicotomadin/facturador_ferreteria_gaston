import { stringify } from 'csv-stringify/sync';

export interface ReviewIssue {
  type: string;
  sourceRow: number;
  code: string;
  description: string;
  detail?: string;
}

// Rows the store owner has to check by hand in the spreadsheet
export function toReviewCsv(issues: ReviewIssue[]): string {
  return stringify(
    issues.map((i) => [i.type, i.sourceRow, i.code, i.description, i.detail ?? '']),
    { header: true, columns: ['issue', 'row', 'code', 'description', 'detail'] },
  );
}

export function countByType(issues: ReviewIssue[]): Record<string, number> {
  return Object.fromEntries(
    Object.entries(Object.groupBy(issues, (i) => i.type)).map(([type, items]) => [type, items?.length ?? 0]),
  );
}
