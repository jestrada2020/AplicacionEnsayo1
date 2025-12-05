const Processor = {
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
            Fecha: row[colMap.fecha] || 'N/A',
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

        return { raw: reportData, stats: stats };
    }

};
