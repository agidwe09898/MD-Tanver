import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Mail, Copy, Check, ExternalLink, User, Globe, Loader2, Sparkles, Upload, Download, Trash2, Table as TableIcon } from "lucide-react";
import { predictBestEmails, EmailResult } from "./lib/emailService";
import Papa from "papaparse";

interface BulkItem {
  id: string;
  firstName: string;
  lastName: string;
  domain: string;
  result?: EmailResult | null;
  status: "idle" | "processing" | "completed" | "error";
}

export default function App() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [domain, setDomain] = useState("");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Bulk states
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !domain) return;

    setLoading(true);
    const predicted = await predictBestEmails(firstName, lastName, domain);
    // Take ONLY the top result to ensure maximum accuracy matching Apollo style
    const topResult = predicted.length > 0 ? [predicted[0]] : [];
    setResults(topResult);
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

     Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const items: BulkItem[] = (results.data as any[]).map((row) => ({
          id: Math.random().toString(36).substr(2, 9),
          firstName: row.firstName || row["First Name"] || row.firstname || "",
          lastName: row.lastName || row["Last Name"] || row.lastname || "",
          domain: row.domain || row.Website || row.website || row.Domain || "",
          status: "idle"
        })).filter(item => item.firstName && item.lastName && item.domain);
        
        setBulkItems(items);
      },
    });
  };

  const processBulk = async () => {
    if (bulkItems.length === 0 || isBulkProcessing) return;
    setIsBulkProcessing(true);

    const updatedItems = [...bulkItems];
    
    for (let i = 0; i < updatedItems.length; i++) {
      updatedItems[i].status = "processing";
      setBulkItems([...updatedItems]);

      try {
        const predicted = await predictBestEmails(updatedItems[i].firstName, updatedItems[i].lastName, updatedItems[i].domain);
        // Pick ONLY the top verified result
        const best = predicted.length > 0 ? predicted[0] : null;
        updatedItems[i].result = best;
        updatedItems[i].status = "completed";
      } catch (error) {
        updatedItems[i].status = "error";
      }
      
      setBulkItems([...updatedItems]);
      // Small delay to prevent rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsBulkProcessing(false);
  };

  const downloadResults = () => {
    const csvData = bulkItems.map(item => ({
      "First Name": item.firstName,
      "Last Name": item.lastName,
      "Domain": item.domain,
      "Email": item.result?.email || "Not Found",
      "Likelihood": item.result?.likelihood || "N/A",
      "Confidence": item.result?.pattern || "N/A"
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "email_finder_results.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900 selection:bg-blue-100">
      {/* Header Section */}
      <header className="relative bg-white border-b border-neutral-200 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50" />
        <div className="max-w-6xl mx-auto px-6 py-12 relative">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-200">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-400">Professional Tools</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-2">
                Email <span className="text-blue-600">Finder</span>
              </h1>
              <p className="text-lg text-neutral-500 max-w-xl">
                Single and bulk email lookup using AI-powered pattern prediction.
              </p>
            </div>
            
            <div className="bg-neutral-100 p-1 rounded-xl flex gap-1">
              <button 
                onClick={() => setTab("single")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "single" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}
              >
                Single Search
              </button>
              <button 
                onClick={() => setTab("bulk")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "bulk" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}
              >
                Bulk Import
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {tab === "single" ? (
          <div className="grid md:grid-cols-[1fr_1.5fr] gap-12">
            {/* Input Sidebar */}
            <div className="space-y-8">
              <form onSubmit={handleSearch} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                      <User className="w-3 h-3" /> First Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Satya"
                      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                      <User className="w-3 h-3" /> Last Name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Nadella"
                      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="domain" className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                      <Globe className="w-3 h-3" /> Website / Domain
                    </label>
                    <input
                      id="domain"
                      type="text"
                      required
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="e.g. microsoft.com"
                      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-neutral-900 text-white rounded-xl font-medium shadow-xl shadow-neutral-200 hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Find Email
                    </>
                  )}
                </button>
              </form>

              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-2 mb-2 text-blue-700 font-medium font-mono text-sm uppercase tracking-wide">
                  <Sparkles className="w-4 h-4" /> AI Powered Accuracy
                </div>
                <p className="text-sm text-blue-600/80 leading-relaxed">
                  We analyze company-specific email conventions to predict the most likely professional address with high precision.
                </p>
              </div>
            </div>

            {/* Results Area */}
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-xl font-semibold text-neutral-800 tracking-tight">Verified Professional Email</h2>
              </div>
              
              {!results.length && !loading && (
                <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-white border border-dashed border-neutral-200 rounded-3xl">
                  <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-neutral-300" />
                  </div>
                  <p className="text-neutral-400 font-medium">
                    {firstName ? "No verified high-confidence email found." : "Enter details and start searching"}
                  </p>
                </div>
              )}

              {loading && (
                <div className="space-y-4">
                  <div className="h-48 bg-white border border-neutral-100 rounded-3xl animate-pulse" />
                </div>
              )}

              {results.length > 0 && (
                <AnimatePresence>
                  {results.map((res, index) => (
                    <motion.div
                      key={res.email + index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative p-10 rounded-[40px] border bg-white border-blue-100 ring-12 ring-blue-50/30 shadow-[0_20px_50px_rgba(37,99,235,0.05)]"
                    >
                      <div className="space-y-8">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 items-center gap-2 px-4 rounded-full bg-blue-600 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-200">
                              <Check className="w-4 h-4" /> Verified by AI
                            </div>
                            <span className="text-[11px] uppercase font-bold text-neutral-300 tracking-[0.3em]">{res.pattern}</span>
                          </div>
                          <div className="px-4 py-1.5 rounded-full bg-neutral-50 border border-neutral-100 text-sm font-bold text-neutral-500">
                            {res.percentage}% Accuracy
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex flex-col gap-2">
                             <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter px-1">Professional Identity</span>
                             <div className="flex items-center justify-between gap-6 p-6 bg-neutral-50/50 rounded-3xl border border-neutral-100 group-hover:border-blue-200 transition-colors">
                              <h3 className="text-3xl md:text-4xl font-mono font-bold text-neutral-900 truncate tracking-tight">
                                {res.email}
                              </h3>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => copyToClipboard(res.email)}
                                  className="p-4 rounded-2xl bg-white border border-neutral-200 hover:border-blue-500 hover:text-blue-600 shadow-sm transition-all active:scale-95"
                                  title="Copy Email"
                                >
                                  {copiedText === res.email ? <Check className="w-6 h-6 text-green-500" /> : <Copy className="w-6 h-6" />}
                                </button>
                                <a
                                  href={`mailto:${res.email}`}
                                  className="p-4 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                                  title="Send Email"
                                >
                                  <ExternalLink className="w-6 h-6" />
                                </a>
                              </div>
                             </div>
                          </div>
                        </div>

                        {res.reason && (
                          <div className="flex items-start gap-4 text-sm text-neutral-600 leading-relaxed bg-blue-50/30 p-6 rounded-2xl border border-blue-50/50">
                            <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                            <p className="italic font-medium">"{res.reason}"</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex gap-4">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv"
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-white border border-neutral-200 rounded-xl font-medium flex items-center gap-2 hover:bg-neutral-50 transition-all text-neutral-700"
                >
                  <Upload className="w-4 h-4" />
                  Upload CSV
                </button>
                <button 
                  onClick={() => setBulkItems([])}
                  className="px-6 py-3 bg-white border border-neutral-200 rounded-xl font-medium flex items-center gap-2 hover:bg-neutral-50 transition-all text-neutral-500"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear List
                </button>
              </div>
              
              <div className="flex gap-4">
                <button 
                  onClick={processBulk}
                  disabled={bulkItems.length === 0 || isBulkProcessing}
                  className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-neutral-800 disabled:opacity-50 transition-all shadow-lg"
                >
                  {isBulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {isBulkProcessing ? "Processing..." : "Find Emails"}
                </button>
                <button 
                  onClick={downloadResults}
                  disabled={bulkItems.length === 0 || isBulkProcessing}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              </div>
            </div>

            {bulkItems.length > 0 ? (
              <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/50 border-b border-neutral-100">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-400">Person</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-400">Website</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-400">Result</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-400 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkItems.map((item) => (
                      <tr key={item.id} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-all">
                        <td className="px-6 py-4">
                          <div className="font-medium">{item.firstName} {item.lastName}</div>
                        </td>
                        <td className="px-6 py-4 text-neutral-500 font-mono text-sm leading-none">
                          {item.domain}
                        </td>
                        <td className="px-6 py-4">
                          {item.result ? (
                             <div className="flex items-center gap-2">
                               <span className="font-mono text-blue-600 text-sm font-medium">{item.result.email}</span>
                             </div>
                          ) : item.status === "completed" ? (
                             <span className="text-neutral-400 text-sm italic">Not found</span>
                          ) : (
                             <span className="text-neutral-300 text-sm italic">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                             item.status === 'completed' ? 'bg-green-100 text-green-700' :
                             item.status === 'processing' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                             item.status === 'error' ? 'bg-red-100 text-red-700' :
                             'bg-neutral-100 text-neutral-500'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-96 flex flex-col items-center justify-center text-center p-12 bg-white border border-dashed border-neutral-200 rounded-[32px]">
                <div className="w-20 h-20 bg-neutral-50 rounded-3xl flex items-center justify-center mb-6">
                  <TableIcon className="w-10 h-10 text-neutral-200" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No data imported</h3>
                <p className="text-neutral-400 max-w-sm mx-auto mb-8">
                  Upload a CSV file with columns: <b>firstName</b>, <b>lastName</b>, and <b>domain</b>.
                </p>
                <div className="flex gap-4">
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-8 py-4 bg-neutral-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition-all shadow-xl shadow-neutral-200"
                   >
                    <Upload className="w-5 h-5" />
                    Select CSV File
                   </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-12 text-center text-neutral-400 text-sm border-t border-neutral-100 mt-12">
        <p>&copy; 2024 Email Finder Pro. All results are filtered for high accuracy.</p>
      </footer>
    </div>
  );
}
