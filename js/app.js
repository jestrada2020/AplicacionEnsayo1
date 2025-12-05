document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const resetBtn = document.getElementById('reset-btn');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const btnExportExcel = document.getElementById('btn-export-excel');
    const btnExportSpecial = document.getElementById('btn-export-special');
    const btnExportSpecialExcel = document.getElementById('btn-export-special-excel');

    // Processors
    let currentData = null;
    let currentStats = null;

    // File Upload Handlers
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length) handleFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    // Reset Handle
    resetBtn.addEventListener('click', () => {
        window.location.reload();
    });

    // Export Handlers
    btnExportPdf.addEventListener('click', () => {
        if (currentStats) {
            Reporter.generatePDF(currentStats, 'Reporte_Vetiplus_2025.pdf');
        }
    });

    btnExportExcel.addEventListener('click', () => {
        if (currentStats) {
            Reporter.generateExcel(currentStats, 'Reporte_Vetiplus_2025.xlsx');
        }
    });

    btnExportSpecial.addEventListener('click', () => {
        if (currentData) {
            const specialData = Processor.getSpecialReportData(currentData);
            Reporter.generateSpecialPDF(specialData, 'Reporte_Veterinario_Especializado.pdf');
        }
    });

    btnExportSpecialExcel.addEventListener('click', () => {
        if (currentData) {
            const specialData = Processor.getSpecialReportData(currentData);
            Reporter.generateSpecialExcel(specialData, 'Reporte_Veterinario_Especializado.xlsx');
        }
    });

    async function handleFile(file) {
        UI.showLoading();

        try {
            // Read Excel
            const rawData = await Processor.readExcel(file);
            console.log("Raw Data:", rawData);

            // Process Data
            currentStats = Processor.calculateStats(rawData);
            currentData = rawData;

            console.log("Stats:", currentStats);

            // Render Dashboard
            UI.renderDashboard(currentStats, rawData);
            UI.showDashboard();

        } catch (error) {
            console.error(error);
            alert('Error al procesar el archivo: ' + error.message);
            UI.showUpload();
        }
    }
});

const UI = {
    showLoading: () => {
        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('status-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
    },

    showDashboard: () => {
        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('status-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
    },

    showUpload: () => {
        document.getElementById('upload-section').classList.remove('hidden');
        document.getElementById('status-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
    },

    renderDashboard: (stats, rawData) => {
        const container = document.getElementById('basic-stats');
        container.innerHTML = '';

        // Helper to create cards
        const createCard = (label, value) => {
            return `
                <div class="stat-card">
                    <div class="label">${label}</div>
                    <div class="value">${value}</div>
                </div>
            `;
        };

        // General Stats
        container.innerHTML += createCard('Total Registros', stats.totalRows);
        container.innerHTML += createCard('Columnas', stats.totalColumns);

        // Render preview table (first 5 rows)
        const tableContainer = document.getElementById('data-preview-container');
        if (rawData.length > 0) {
            let html = '<table><thead><tr>';
            const headers = Object.keys(rawData[0]);
            headers.forEach(h => html += `<th>${h}</th>`);
            html += '</tr></thead><tbody>';

            rawData.slice(0, 5).forEach(row => {
                html += '<tr>';
                headers.forEach(h => html += `<td>${row[h] || ''}</td>`);
                html += '</tr>';
            });
            html += '</tbody></table>';
            html += `<p style="padding: 1rem; color: var(--text-muted); font-size: 0.9rem;">Mostrando 5 de ${rawData.length} registros</p>`;
            tableContainer.innerHTML = html;
        }
    }
};
