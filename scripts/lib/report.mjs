// Collects per-entry outcomes and prints the end-of-build summary.

export function createReport() {
  const rows = [];
  return {
    ok(kind, label, detail, warnings = []) {
      rows.push({ kind, label, status: 'ok', detail, warnings });
      for (const warning of warnings) console.warn(`  warn  ${label}: ${warning}`);
    },
    skip(kind, label, reason) {
      rows.push({ kind, label, status: 'skipped', detail: reason, warnings: [] });
      console.warn(`  skip  ${label}: ${reason}`);
    },
    get skipped() {
      return rows.filter((row) => row.status === 'skipped').length;
    },
    get warnings() {
      return rows.reduce((sum, row) => sum + row.warnings.length, 0);
    },
    print({ elapsedMs, totals }) {
      const header = ['kind', 'status', 'entry', 'id / reason'];
      const body = rows.map((row) => [
        row.kind,
        row.warnings.length ? `${row.status} (${row.warnings.length} warn)` : row.status,
        row.label,
        row.detail,
      ]);
      const widths = header.map((_, col) =>
        Math.min(60, Math.max(header[col].length, ...body.map((cells) => cells[col].length))),
      );
      const line = (cells) => cells.map((cell, col) => (col === 3 ? cell : cell.padEnd(widths[col]))).join('  ');
      console.log(`\n${line(header)}\n${line(widths.map((width) => '-'.repeat(width)))}`);
      for (const cells of body) console.log(line(cells));
      console.log(
        `\n${totals.skills} skills (${totals.local} local), ${totals.collections} collections, ` +
          `${totals.files} files, ${formatBytes(totals.bytes)}; ${this.skipped} skipped, ${this.warnings} warnings; ` +
          `${(elapsedMs / 1000).toFixed(1)}s`,
      );
    },
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
