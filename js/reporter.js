const Reporter = {
    generatePDF: (stats, filename) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');

        // Header
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229); // Primary color
        doc.text("Reporte Estadístico Vetiplus 2025", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Total Registros: ${stats.totalRows}`, 14, 34);
        doc.text(`Total Variables: ${stats.totalColumns}`, 14, 40);

        let yPos = 50;

        // Iterate through columns
        Object.entries(stats.columns).forEach(([colName, colStats]) => {
            // Check page break
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text(`Variable: ${colName}`, 14, yPos);
            yPos += 8;

            doc.setFontSize(10);
            doc.setTextColor(80);

            if (colStats.type === 'numeric') {
                const data = [
                    ['Media (Promedio)', colStats.mean],
                    ['Mediana', colStats.median],
                    ['Mínimo', colStats.min],
                    ['Máximo', colStats.max],
                    ['Conteo de Datos', colStats.count]
                ];

                doc.autoTable({
                    startY: yPos,
                    head: [['Estadístico', 'Valor']],
                    body: data,
                    theme: 'striped',
                    headStyles: { fillColor: [79, 70, 229] },
                    margin: { left: 14 }
                });

                yPos = doc.lastAutoTable.finalY + 15;

            } else {
                // For text columns, show top 5 frequencies
                const topFreq = Object.entries(colStats.frequency).slice(0, 10);
                const data = topFreq.map(([val, count]) => [val, count, ((count / stats.totalRows) * 100).toFixed(1) + '%']);

                doc.text(`Top 10 Frecuencias (Total únicos: ${Object.keys(colStats.frequency).length})`, 14, yPos);
                yPos += 5;

                doc.autoTable({
                    startY: yPos,
                    head: [['Valor', 'Frecuencia', 'Porcentaje']],
                    body: data,
                    theme: 'grid',
                    headStyles: { fillColor: [100, 116, 139] },
                    margin: { left: 14 }
                });

                yPos = doc.lastAutoTable.finalY + 15;
            }
        });

        doc.save(filename);
    },

    generateExcel: (stats, filename) => {
        const wb = XLSX.utils.book_new();

        // 1. Summary Sheet
        const summaryData = [
            ["Reporte Generado", new Date().toLocaleString()],
            ["Total Registros", stats.totalRows],
            ["Total Variables", stats.totalColumns],
            [],
            ["Variable", "Tipo", "Min", "Max", "Promedio", "Mediana", "Valores Únicos"]
        ];

        Object.entries(stats.columns).forEach(([colName, colStats]) => {
            if (colStats.type === 'numeric') {
                summaryData.push([
                    colName,
                    "Numérico",
                    colStats.min,
                    colStats.max,
                    colStats.mean,
                    colStats.median,
                    "-"
                ]);
            } else {
                summaryData.push([
                    colName,
                    "Texto",
                    "-",
                    "-",
                    "-",
                    "-",
                    Object.keys(colStats.frequency).length
                ]);
            }
        });

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen General");

        // 2. Frequency Sheets for Text Data
        const textCols = Object.entries(stats.columns).filter(([_, s]) => s.type === 'text');

        // Combine all text frequencies into one long sheet or separate? 
        // Let's make a "Frecuencias" sheet
        const freqData = [["Variable", "Valor", "Frecuencia", "Porcentaje"]];

        textCols.forEach(([colName, colStats]) => {
            Object.entries(colStats.frequency).forEach(([val, count]) => {
                freqData.push([
                    colName,
                    val,
                    count,
                    ((count / stats.totalRows) * 100).toFixed(2) + '%'
                ]);
            });
            freqData.push([]); // Spacer
        });

        if (textCols.length > 0) {
            const wsFreq = XLSX.utils.aoa_to_sheet(freqData);
            XLSX.utils.book_append_sheet(wb, wsFreq, "Detalle Frecuencias");
        }

        XLSX.writeFile(wb, filename);
    },

    generateSpecialPDF: (specialData, filename) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        const { raw, stats } = specialData;

        // Header
        doc.setFontSize(18);
        doc.setTextColor(220, 38, 38); // Red color for special report
        doc.text("Reporte Veterinario Especializado", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Total Casos Analizados: ${stats.totalCases}`, 14, 34);

        let yPos = 45;

        // 1. Stats Summary
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Resumen Estadístico", 14, yPos);
        yPos += 10;

        // Disease Distribution
        const diseaseData = Object.entries(stats.byDisease).map(([d, c]) => [d, c, stats.positivityRate[d] || 'N/A']);
        doc.autoTable({
            startY: yPos,
            head: [['Enfermedad', 'Casos', 'Tasa Positividad']],
            body: diseaseData,
            theme: 'grid',
            headStyles: { fillColor: [220, 38, 38] },
            margin: { left: 14 }
        });
        yPos = doc.lastAutoTable.finalY + 15;

        // Result Distribution
        doc.text("Distribución de Resultados", 14, yPos);
        yPos += 5;
        const resultData = Object.entries(stats.byResult).map(([r, c]) => [r, c]);
        doc.autoTable({
            startY: yPos,
            head: [['Resultado', 'Cantidad']],
            body: resultData,
            theme: 'striped',
            margin: { left: 14 }
        });
        yPos = doc.lastAutoTable.finalY + 15;

        // 2. Detailed List (First 100 to avoid huge PDF if large data)
        if (yPos > 250) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.text("Detalle de Registros (Últimos 100)", 14, yPos);
        yPos += 10;

        const tableBody = raw.slice(0, 100).map(r => [
            r.Fecha, r.Granja, r.Propietario, r.Enfermedad, r.Resultado
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Fecha', 'Granja', 'Propietario', 'Enfermedad', 'Resultado']],
            body: tableBody,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [50, 50, 50] }
        });

        doc.autoTable({
            startY: yPos,
            head: [['Fecha', 'Granja', 'Propietario', 'Enfermedad', 'Resultado']],
            body: tableBody,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [50, 50, 50] }
        });

        // 3. Statistical Analysis & Box Plots
        doc.addPage();
        yPos = 20;
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text("Análisis Estadístico de Frecuencias (Diagramas de Caja)", 14, yPos);
        yPos += 15;

        // Stats Table
        const bpStats = stats.boxPlots;
        const statsData = [
            ['Granjas (Casos por Granja)', bpStats.farms.min, bpStats.farms.q1.toFixed(1), bpStats.farms.median.toFixed(1), bpStats.farms.q3.toFixed(1), bpStats.farms.max],
            ['Enfermedades (Casos por Enf.)', bpStats.diseases.min, bpStats.diseases.q1.toFixed(1), bpStats.diseases.median.toFixed(1), bpStats.diseases.q3.toFixed(1), bpStats.diseases.max],
            ['Propietarios (Casos por Prop.)', bpStats.owners.min, bpStats.owners.q1.toFixed(1), bpStats.owners.median.toFixed(1), bpStats.owners.q3.toFixed(1), bpStats.owners.max]
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Categoría', 'Min', 'Q1 (25%)', 'Mediana', 'Q3 (75%)', 'Max']],
            body: statsData,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Helper to check page break
        const checkPage = (height) => {
            if (yPos + height > 190) {
                doc.addPage();
                yPos = 20;
            }
        };

        checkPage(60);
        if (bpStats.farms.max > 0) {
            Reporter.drawBoxPlot(doc, 40, yPos, 200, 50, bpStats.farms, "Distribución: Casos por Granja");
            yPos += 60;
        }

        checkPage(60);
        if (bpStats.diseases.max > 0) {
            Reporter.drawBoxPlot(doc, 40, yPos, 200, 50, bpStats.diseases, "Distribución: Casos por Enfermedad");
            yPos += 60;
        }

        checkPage(60);
        if (bpStats.owners.max > 0) {
            Reporter.drawBoxPlot(doc, 40, yPos, 200, 50, bpStats.owners, "Distribución: Casos por Propietario");
        }

        // 4. Frequency Tables and Bar Charts
        doc.addPage();
        yPos = 20;
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text("Tablas de Frecuencia y Gráficos de Barra", 14, yPos);
        yPos += 15;

        const categories = [
            { name: 'Enfermedad', data: stats.byDisease },
            { name: 'Resultado', data: stats.byResult },
            { name: 'Granja', data: stats.byFarm },
            { name: 'Propietario', data: stats.byOwner }
        ];

        categories.forEach(cat => {
            // Check space for Title + Table (approx 10 rows usually) + Chart
            // If we are low on page, break
            if (yPos > 150) { doc.addPage(); yPos = 20; }

            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text(`Frecuencia: ${cat.name}`, 14, yPos);
            yPos += 10;

            // Prepare Data (Top 10 for chart, but table can be longer - let's limit table to top 15 to fit)
            const entries = Object.entries(cat.data).sort((a, b) => b[1] - a[1]);
            const topEntries = entries.slice(0, 15);

            const tableData = topEntries.map(([k, v]) => [k, v, ((v / stats.totalCases) * 100).toFixed(1) + '%']);

            doc.autoTable({
                startY: yPos,
                head: [['Valor', 'Frecuencia', '%']],
                body: tableData,
                theme: 'striped',
                margin: { left: 14, right: 150 }, // Keep table to the left
                tableWidth: 100
            });

            let tableBottom = doc.lastAutoTable.finalY;

            // Draw Chart on the right side of the table or below?
            // Let's draw it to the right of the table if it fits, otherwise below.
            // Landscape width ~297mm. Table width 100mm. Start chart at 130mm.
            Reporter.drawBarChart(doc, 130, yPos, 150, (tableBottom - yPos > 60 ? tableBottom - yPos : 60), entries.slice(0, 10), `Top 10 ${cat.name}`);

            yPos = (tableBottom > yPos + 60 ? tableBottom : yPos + 60) + 20;
        });

        doc.save(filename);
    },

    drawBarChart: (doc, x, y, width, height, data, title) => {
        // Data is [[label, value], ...]
        if (data.length === 0) return;

        const maxValue = Math.max(...data.map(d => d[1]));
        const barHeight = (height - 20) / data.length;
        const maxBarWidth = width - 40; // Leave space for labels

        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(title, x + width / 2, y, { align: 'center' });

        let currentY = y + 10;

        data.forEach(([label, value]) => {
            const barWidth = (value / maxValue) * maxBarWidth;

            // Text Label (Truncate if too long)
            let displayLabel = label.length > 15 ? label.substring(0, 15) + '...' : label;
            doc.setFontSize(8);
            doc.text(displayLabel, x, currentY + barHeight / 2 + 2);

            // Bar
            doc.setFillColor(79, 70, 229);
            doc.rect(x + 35, currentY, barWidth, barHeight - 2, 'F');

            // Value Label
            doc.setTextColor(100);
            doc.text(value.toString(), x + 35 + barWidth + 2, currentY + barHeight / 2 + 2);

            currentY += barHeight;
        });
    },

    drawBoxPlot: (doc, x, y, width, height, stats, label) => {
        // Stats: min, q1, median, q3, max
        const maxVal = stats.max > 0 ? stats.max : 10;
        const scale = (val) => x + 20 + ((val / (maxVal * 1.1)) * (width - 40));

        const xMin = scale(stats.min);
        const xQ1 = scale(stats.q1);
        const xMed = scale(stats.median);
        const xQ3 = scale(stats.q3);
        const xMax = scale(stats.max);
        const yMid = y + height / 2;

        doc.setDrawColor(0);
        doc.setLineWidth(0.5);

        // Title
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(label, x, y + 5);

        // Axis Line
        doc.line(x + 20, y + height - 10, x + width - 20, y + height - 10);

        // Draw Ticks (0 and Max)
        doc.setFontSize(8);
        doc.text("0", x + 20, y + height - 5);
        doc.text(maxVal.toString(), x + width - 20, y + height - 5);

        // Box
        doc.setFillColor(200, 200, 255);
        doc.rect(xQ1, yMid - 8, xQ3 - xQ1, 16, 'FD');

        // Median Line
        doc.setLineWidth(1);
        doc.line(xMed, yMid - 8, xMed, yMid + 8);

        // Whiskers
        doc.setLineWidth(0.5);
        doc.line(xMin, yMid, xQ1, yMid); // Left
        doc.line(xQ3, yMid, xMax, yMid); // Right

        // Whisker Caps
        doc.line(xMin, yMid - 4, xMin, yMid + 4);
        doc.line(xMax, yMid - 4, xMax, yMid + 4);

        // Labels
        doc.setTextColor(100);
        doc.text(stats.min.toFixed(0), xMin - 2, yMid + 12);
        doc.text(stats.median.toFixed(1), xMed - 2, yMid - 10);
        doc.text(stats.max.toString(), xMax - 2, yMid + 12);
    }

};
