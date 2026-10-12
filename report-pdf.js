// Small server-side PDF writer for plain-text experiment summaries.
const ascii = (value) => String(value ?? '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '?');
const escapeText = (value) => ascii(value).replace(/[\\()]/g, '\\$&');

export const createExperimentPdf = ({ name, algorithm, completedAt, rounds, testMetrics, splitCounts }) => {
  const lines = [
    'Federated Learning Experiment Report',
    `Experiment: ${name}`,
    `Completed: ${completedAt}`,
    `Algorithm: ${algorithm}`,
    `Execution: local simulation; no secure aggregation or formal DP guarantee`,
    `Rounds: ${rounds.length}`,
    `Held-out test records: ${testMetrics.records}`,
    `Test accuracy: ${(testMetrics.accuracy * 100).toFixed(2)}%`,
    `Test precision: ${(testMetrics.precision * 100).toFixed(2)}%`,
    `Test recall: ${(testMetrics.recall * 100).toFixed(2)}%`,
    `Test F1: ${(testMetrics.f1 * 100).toFixed(2)}%`,
    `Test ROC-AUC: ${testMetrics.auc_roc == null ? 'unavailable' : testMetrics.auc_roc.toFixed(4)}`,
    `Test loss: ${testMetrics.loss.toFixed(4)}`,
    '', 'Per-client split counts (train / validation / test):',
    ...Object.entries(splitCounts).map(([client, counts]) => `${client}: ${counts.train} / ${counts.validation} / ${counts.test}`),
    '', 'Validation accuracy by round:',
    ...rounds.map((round) => `Round ${round.round}: ${(round.global_metrics.accuracy * 100).toFixed(2)}%; loss ${round.global_metrics.loss.toFixed(4)}; estimated communication ${round.communication_bytes} bytes`)
  ].slice(0, 46);
  const stream = `BT /F1 11 Tf 48 780 Td 15 TL ${lines.map((line, index) => `${index ? 'T* ' : ''}(${escapeText(line)}) Tj`).join('\n')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const start = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(output, 'ascii');
};
