const Reporter = {
    generatePDF: (stats, filename) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

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
        const doc = new jsPDF();
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

        doc.save(filename);
    }

};
