const Processor = {
    // Helper to format date
    formatDate: (val) => {
        if (!val) return 'N/A';
        // Excel Serial Date
        if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear().toString().slice(-2); // yy
            return `${d}-${m}-${y}`;
        }
        // String Date handling (try to parse)
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear().toString().slice(-2);
            return `${d}-${m}-${y}`;
        }
        return val; // Return original if parsing fails
    },

    // Read Excel File
    readExcel: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Assume first sheet is the one we want
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                    resolve(jsonData);
                } catch (err) {
                    reject(err);
                }
            };

            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    },

    // Calculate Statistics
    calculateStats: (data) => {
        if (!data || data.length === 0) return null;

        const headers = Object.keys(data[0]);
        const stats = {
            totalRows: data.length,
            totalColumns: headers.length,
            columns: {}
        };

        headers.forEach(header => {
            // Extract column values
            const values = data.map(row => row[header]);

            // Determine type (Numeric or String)
            // specific check: if more than 80% are numbers, treat as numeric
            const numericValues = values.filter(v => v !== "" && !isNaN(Number(v))).map(v => Number(v));
            const isNumeric = numericValues.length > (values.length * 0.8);

            if (isNumeric) {
                stats.columns[header] = {
                    type: 'numeric',
                    count: numericValues.length,
                    min: Math.min(...numericValues),
                    max: Math.max(...numericValues),
                    mean: Processor.mean(numericValues),
                    median: Processor.median(numericValues),
                    // For histogram/distribution
                    distribution: Processor.frequency(numericValues)
                };
            } else {
                stats.columns[header] = {
                    type: 'text',
                    count: values.filter(v => v !== "").length,
                    frequency: Processor.frequency(values.filter(v => v !== ""))
                };
            }
        });

        return stats;
    },

    // Helpers
    mean: (arr) => {
        if (arr.length === 0) return 0;
        return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
    },

    median: (arr) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2);
    },

    frequency: (arr) => {
        const freq = {};
        arr.forEach(val => {
            freq[val] = (freq[val] || 0) + 1;
        });
        // Sort by frequency desc
        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1]) // Descending
            .reduce((obj, [key, val]) => {
                obj[key] = val;
                return obj;
            }, {});
    },

    // Special Report Logic
    getSpecialReportData: (data) => {
        // Expected columns: Fecha, Granja o predio, Propietario, Enfermedad, Resultado
        // We will try to find columns that match loosely case-insensitive
        const headers = Object.keys(data[0]);
        const findCol = (name) => headers.find(h => h.toLowerCase().includes(name.toLowerCase()));

        const colMap = {
            fecha: findCol('Fecha'),
            granja: findCol('Granja') || findCol('Predio'),
            propietario: findCol('Propietario'),
            enfermedad: findCol('Enfermedad'),
            resultado: findCol('Resultado')
        };

        // Filter data to only these columns
        const reportData = data.map(row => ({
            Fecha: Processor.formatDate(row[colMap.fecha]),
            Granja: row[colMap.granja] || 'N/A',
            Propietario: row[colMap.propietario] || 'N/A',
            Enfermedad: row[colMap.enfermedad] || 'N/A',
            Resultado: row[colMap.resultado] || 'N/A'
        }));

        // Calculate Specific Stats
        const stats = {
            totalCases: reportData.length,
            byDisease: Processor.frequency(reportData.map(d => d.Enfermedad)),
            byResult: Processor.frequency(reportData.map(d => d.Resultado)),
            byFarm: Processor.frequency(reportData.map(d => d.Granja)),
            byOwner: Processor.frequency(reportData.map(d => d.Propietario)),
            positivityRate: {}
        };

        // Calculate positivity info if "Positivo" exists in results
        // Group by disease, then count positive
        const diseaseGroups = {};
        reportData.forEach(row => {
            const disease = row.Enfermedad;
            const res = String(row.Resultado).toLowerCase();

            if (!diseaseGroups[disease]) diseaseGroups[disease] = { total: 0, positive: 0 };
            diseaseGroups[disease].total++;
            if (res.includes('positivo') || res.includes('detectado') || res === 'si') {
                diseaseGroups[disease].positive++;
            }
        });

        Object.entries(diseaseGroups).forEach(([dis, counts]) => {
            stats.positivityRate[dis] = ((counts.positive / counts.total) * 100).toFixed(1) + '%';
        });

        // Box Plot Stats (Distribution of Counts)
        const farmCounts = Object.values(stats.byFarm).sort((a, b) => a - b);
        const diseaseCounts = Object.values(stats.byDisease).sort((a, b) => a - b);
        // NEW: Owner Counts
        const ownerFrequency = Processor.frequency(reportData.map(d => d.Propietario));
        const ownerCounts = Object.values(ownerFrequency).sort((a, b) => a - b);


        stats.boxPlots = {
            farms: Processor.calculateQuartiles(farmCounts),
            diseases: Processor.calculateQuartiles(diseaseCounts),
            owners: Processor.calculateQuartiles(ownerCounts)
        };

        return { raw: reportData, stats: stats };
    },

    calculateQuartiles: (sortedArr) => {
        if (sortedArr.length === 0) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };

        const quantile = (arr, q) => {
            const pos = (arr.length - 1) * q;
            const base = Math.floor(pos);
            const rest = pos - base;
            if (arr[base + 1] !== undefined) {
                return arr[base] + rest * (arr[base + 1] - arr[base]);
            } else {
                return arr[base];
            }
        };

        return {
            min: sortedArr[0],
            q1: quantile(sortedArr, 0.25),
            median: quantile(sortedArr, 0.5),
            q3: quantile(sortedArr, 0.75),
            max: sortedArr[sortedArr.length - 1]
        };
    }


};
