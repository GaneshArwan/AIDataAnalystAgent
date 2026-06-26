/**
 * Helper to prepare data for Recharts based on the chart configuration.
 */
export function formatChartData(data: any[], config: any) {
  if (!config || config.type === 'none' || !data.length) return [];

  // For Recharts, we often just need the raw array of objects
  // but we can ensure the types are correct or handle specific series mapping.
  return data.map(item => {
    const formatted: Record<string, any> = { [config.xAxisKey]: item[config.xAxisKey] };
    config.series.forEach((key: string) => {
      const val = parseFloat(item[key]);
      formatted[key] = isNaN(val) ? item[key] : val;
    });
    return formatted;
  });
}

/**
 * Gets the color for a specific series index.
 */
export function getChartColor(index: number) {
  const colors = [
    '#2563eb', // blue-600
    '#dc2626', // red-600
    '#16a34a', // green-600
    '#ca8a04', // yellow-600
    '#7c3aed', // violet-600
    '#db2777', // pink-600
    '#0891b2', // cyan-600
    '#ea580c', // orange-600
  ];
  return colors[index % colors.length];
}
