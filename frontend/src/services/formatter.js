/**
 * Format number in Indian numbering system (Lakh/Crore)
 * Examples:
 * 10000000 → ₨1,00,00,000.00 (1 crore)
 * 7000000 → ₨70,00,000.00 (70 lakh)
 * 50000 → ₨50,000.00
 */
export function formatIndianCurrency(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '₨0.00';
    }

    const parts = Math.abs(num).toFixed(2).split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1];

    // Last 3 digits
    let result = integerPart.slice(-3);
    let remaining = integerPart.slice(0, -3);

    // Add commas every 2 digits for remaining part
    while (remaining.length > 0) {
        if (remaining.length <= 2) {
            result = remaining + ',' + result;
            remaining = '';
        } else {
            result = remaining.slice(-2) + ',' + result;
            remaining = remaining.slice(0, -2);
        }
    }

    const sign = num < 0 ? '-' : '';
    return `${sign}₨${result}.${decimalPart}`;
}

/**
 * Format number in plain Indian format without currency symbol
 */
export function formatIndianNumber(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0';
    }

    const formatted = formatIndianCurrency(num);
    return formatted.replace('₨', '').replace('-₨', '-');
}

/**
 * Format quantity with 2 decimal places and unit
 */
export function formatQuantity(qty, unit = 'KG') {
    if (qty === null || qty === undefined || isNaN(qty)) {
        return `0.00 ${unit}`;
    }
    return `${parseFloat(qty).toFixed(2)} ${unit}`;
}

/**
 * Format date for display (DD/MM/YYYY)
 */
export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export function formatDateForInput(dateString) {
    if (!dateString) return getTodayDate();
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parse Indian formatted number back to float
 */
export function parseIndianNumber(str) {
    if (!str) return 0;
    // Remove currency symbol and commas
    const cleaned = str.toString().replace(/[₨,]/g, '');
    return parseFloat(cleaned) || 0;
}
