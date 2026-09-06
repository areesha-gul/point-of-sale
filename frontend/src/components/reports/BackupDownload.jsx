import { useState } from 'react';
import { reports } from '../../services/api';

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function getRange(type) {
    const end = new Date();
    const start = new Date();
    if (type === 'week') start.setDate(start.getDate() - 7);
    if (type === 'month') start.setMonth(start.getMonth() - 1);
    return { startDate: formatDate(start), endDate: formatDate(end) };
}

export default function BackupDownload() {
    const [range, setRange] = useState('month');
    const [custom, setCustom] = useState({ startDate: '', endDate: '' });
    const [downloading, setDownloading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const download = async () => {
        setDownloading(true);
        setMessage('');
        setError('');
        try {
            const params = range === 'all' ? {} : range === 'custom' ? custom : getRange(range);
            const response = await reports.downloadBackup(params);
            const url = URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = `pos-backup-${range}-${formatDate(new Date())}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            setMessage('Backup downloaded. Keep it somewhere safe.');
        } catch (err) {
            setError(err.response?.data?.error || 'Could not download backup');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="page-shell">
            <div className="mb-6">
                <h1 className="page-title">Download Backup</h1>
                <p className="page-help">Save a copy of your records every week or month.</p>
            </div>

            <div className="card form-card max-w-2xl">
                <h2 className="form-section-title">Which records do you want?</h2>
                <div className="form-grid">
                    <label className="choice-row">
                        <input type="radio" name="range" checked={range === 'week'} onChange={() => setRange('week')} />
                        <span><strong>Last 7 days</strong><small>Recent work from this week</small></span>
                    </label>
                    <label className="choice-row">
                        <input type="radio" name="range" checked={range === 'month'} onChange={() => setRange('month')} />
                        <span><strong>Last month</strong><small>Recent work from the last 30 days</small></span>
                    </label>
                    <label className="choice-row">
                        <input type="radio" name="range" checked={range === 'all'} onChange={() => setRange('all')} />
                        <span><strong>Everything</strong><small>All records in the system</small></span>
                    </label>
                    <label className="choice-row">
                        <input type="radio" name="range" checked={range === 'custom'} onChange={() => setRange('custom')} />
                        <span><strong>Choose dates</strong><small>Select a specific period</small></span>
                    </label>
                </div>

                {range === 'custom' && <div className="form-grid mt-5 grid-cols-1 md:grid-cols-2">
                    <div><label className="label">From</label><input className="input" type="date" value={custom.startDate} onChange={event => setCustom({ ...custom, startDate: event.target.value })} required /></div>
                    <div><label className="label">To</label><input className="input" type="date" value={custom.endDate} onChange={event => setCustom({ ...custom, endDate: event.target.value })} required /></div>
                </div>}

                {error && <p className="form-error">{error}</p>}
                {message && <p className="form-success">{message}</p>}
                <button className="btn-primary mt-6 w-full text-xl" onClick={download} disabled={downloading || (range === 'custom' && (!custom.startDate || !custom.endDate))}>
                    {downloading ? 'Preparing backup...' : 'Download Backup File'}
                </button>
            </div>
        </div>
    );
}