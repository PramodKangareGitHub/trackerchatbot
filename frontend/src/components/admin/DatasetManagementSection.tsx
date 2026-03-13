import type { Dataset } from "./types";

export type DatasetManagementSectionProps = {
  datasets: Dataset[];
  datasetsLoading: boolean;
  actionLoading: boolean;
  onDeleteDataset: (id: string) => void;
  onClearAll: () => void;
};

const DatasetManagementSection = ({
  datasets,
  datasetsLoading,
  actionLoading,
  onDeleteDataset,
  onClearAll,
}: DatasetManagementSectionProps) => {
  const exportTemplates = () => {
    const order = [
      "customer_requirements",
      "hcl_demand",
      "interviewed_candidate_details",
      "hcl_onboarding_status",
      "optum_onboarding_status",
    ];
    const escapeXml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const worksheets = order.map((table) => {
      const ds = datasets.find((d) => d.table_name === table);
      const cols = ds?.columns || [];
      const headerCells = cols
        .map(
          (c) => `<Cell><Data ss:Type="String">${escapeXml(c)}</Data></Cell>`
        )
        .join("");
      return `
        <Worksheet ss:Name="${escapeXml(table)}">
          <Table>
            <Row>${headerCells}</Row>
          </Table>
        </Worksheet>`;
    });

    const workbook = `<?xml version="1.0"?>
      <?mso-application progid="Excel.Sheet"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:html="http://www.w3.org/TR/REC-html40">
        <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
          <Title>Dataset Templates</Title>
        </DocumentProperties>
        <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
          <ProtectStructure>False</ProtectStructure>
          <ProtectWindows>False</ProtectWindows>
        </ExcelWorkbook>
        ${worksheets.join("\n")}
      </Workbook>`;

    const blob = new Blob([workbook], {
      type: "application/vnd.ms-excel",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dataset_templates.xls";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Dataset Management
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportTemplates}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            disabled={datasetsLoading || !datasets.length}
          >
            Export Templates
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-100"
            disabled={actionLoading || datasetsLoading}
          >
            Clear All Datasets
          </button>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        {(datasetsLoading || actionLoading) && (
          <p className="text-slate-500 dark:text-slate-400">Loading…</p>
        )}
        {!datasetsLoading && !datasets.length && (
          <p className="text-slate-500 dark:text-slate-400">No datasets yet.</p>
        )}
        {!datasetsLoading && datasets.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {datasets.map((ds) => (
              <li
                key={ds.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {ds.original_file_name || ds.table_name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ds.row_count} rows • {ds.columns.length} columns
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDeleteDataset(ds.id)}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-100"
                    disabled={actionLoading}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default DatasetManagementSection;
