import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { parseMt5PositionsFromFile, type Mt5PositionRow } from "@/lib/mt5Import";
import { importMt5Trades, type ImportMt5Result } from "@/lib/firestoreService";
import { mapNormalizedMt5RowToTrade } from "@/lib/mt5ImportMapper";
import type { Trade } from "@/types/trading";

export default function ImportTrades() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = (user as any)?.uid || null;

  const [accountId, setAccountId] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedPositions, setParsedPositions] = useState<Mt5PositionRow[]>([]);
  const [mappedTrades, setMappedTrades] = useState<Trade[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportMt5Result | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!userId) {
      setError("Please sign in to import trades.");
      return;
    }

    if (!accountId) {
      setError("Please select an account first.");
      return;
    }

    setIsParsing(true);
    setError(null);
    setImportSummary(null);
    setParsedPositions([]);
    setMappedTrades([]);

    try {
      const positions = await parseMt5PositionsFromFile(file);
      setParsedPositions(positions);

      // Map MT5 positions to Trade objects using the new mapper
      const trades = positions.map((pos) =>
        mapNormalizedMt5RowToTrade(pos, {
          userId: userId!,
          accountId,
        })
      );
      setMappedTrades(trades);

            toast({
        title: "File parsed successfully",
        description: `Found ${positions.length} positions in the MT5 report.`,
      });
    } catch (err: any) {
      console.error("[ImportTrades] Failed to parse MT5 report", err);
      const errorMessage = err.message ?? "Failed to parse MT5 report";
      setError(errorMessage);
      toast({
        title: "Parse error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!userId || !accountId || mappedTrades.length === 0) {
      setError("You must be logged in and have an account selected.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const result = await importMt5Trades(mappedTrades, {
        userId,
        accountId,
      });

      setImportSummary(result);

      if (result.imported > 0) {
      toast({
        title: "Import complete",
          description: `Successfully imported ${result.imported} trade${result.imported !== 1 ? "s" : ""}. ${
            result.skippedDuplicates > 0 ? `${result.skippedDuplicates} duplicate${result.skippedDuplicates !== 1 ? "s" : ""} skipped. ` : ""
          }${result.failed > 0 ? `${result.failed} failed.` : ""}`,
        });
      } else if (result.skippedDuplicates > 0) {
        toast({
          title: "All trades already imported",
          description: `${result.skippedDuplicates} trade${result.skippedDuplicates !== 1 ? "s" : ""} were skipped as duplicates.`,
      });
    } else {
      toast({
        title: "Import failed",
        description: "No trades were imported. Please check the errors.",
        variant: "destructive",
      });
    }
    } catch (err: any) {
      console.error("[ImportTrades] Failed to import MT5 trades", err);
      setError(err.message || "Failed to import MT5 trades. Please try again.");
      toast({
        title: "Import error",
        description: err.message || "Failed to import MT5 trades. Please try again.",
        variant: "destructive",
      });
    } finally {
    setImporting(false);
    }
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Please sign in to import trades.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/trades")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      <div>
          <h1 className="text-3xl font-bold">Import MT5 Trades</h1>
        <p className="text-muted-foreground mt-1">
            Upload a MetaTrader 5 Trade History Report (.xlsx or .csv)
        </p>
        </div>
      </div>

      {/* Account Selection */}
      <Card className="border-border/50 shadow-lg bg-slate-800">
        <CardHeader>
          <CardTitle>Account Selection</CardTitle>
          <CardDescription>Select the account to associate imported trades with</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="accountId">Account ID</Label>
            <Input
              id="accountId"
              placeholder="e.g., MT5-12345678 or Account-1"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter a unique identifier for this trading account (e.g., your MT5 account number)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card className="border-border/50 shadow-lg bg-slate-800">
          <CardHeader>
          <CardTitle>Upload MT5 Report</CardTitle>
            <CardDescription>
            Select a MetaTrader 5 Trade History Report file (.xlsx or .csv)
            </CardDescription>
          </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  disabled={isParsing || !accountId}
                  className="cursor-pointer"
                />
              </div>
              {isParsing && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Parsing file...</span>
                </div>
              )}
            </div>

            {!accountId && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Please enter an Account ID before uploading a file.</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          </CardContent>
        </Card>

      {/* Parsed Summary */}
      {parsedPositions.length > 0 && (
        <>
          <Card className="border-border/50 shadow-lg bg-slate-800">
          <CardHeader>
              <CardTitle>Parsed Positions</CardTitle>
            <CardDescription>
                Detected MT5 Positions report: {parsedPositions.length} trade{parsedPositions.length !== 1 ? "s" : ""} ready to import
            </CardDescription>
          </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Ready to import {mappedTrades.length} trade{mappedTrades.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={importing || mappedTrades.length === 0}
                    className="bg-gradient-primary hover:opacity-90"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import {mappedTrades.length} Trade{mappedTrades.length !== 1 ? "s" : ""}
                      </>
                    )}
              </Button>
            </div>

                {/* Preview Table */}
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                        <TableRow className="bg-slate-700/50">
                    <TableHead>Symbol</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead>Open</TableHead>
                          <TableHead>Close</TableHead>
                          <TableHead className="text-right">Volume</TableHead>
                          <TableHead className="text-right">Entry</TableHead>
                          <TableHead className="text-right">Exit</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                        {parsedPositions.slice(0, 20).map((position, index) => {
                          const trade = mappedTrades[index];
                          
                          // Format open time
                          let openTime: string;
                          if (trade?.openTime instanceof Timestamp) {
                            openTime = trade.openTime.toDate().toLocaleString();
                          } else if (trade?.openTime instanceof Date) {
                            openTime = trade.openTime.toLocaleString();
                          } else if (typeof trade?.openTime === 'string') {
                            openTime = new Date(trade.openTime).toLocaleString();
                          } else {
                            openTime = position.openTime;
                          }
                          
                          // Format close time
                          let closeTime: string;
                          if (trade?.closeTime instanceof Timestamp) {
                            closeTime = trade.closeTime.toDate().toLocaleString();
                          } else if (trade?.closeTime instanceof Date) {
                            closeTime = trade.closeTime.toLocaleString();
                          } else if (typeof trade?.closeTime === 'string') {
                            closeTime = new Date(trade.closeTime).toLocaleString();
                          } else {
                            closeTime = position.closeTime;
                          }
                          
                          return (
                            <TableRow key={index} className="hover:bg-slate-700/30">
                              <TableCell className="font-medium">{position.symbol}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  position.type === "buy" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                }`}>
                                  {position.type.toUpperCase()}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{openTime}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{closeTime}</TableCell>
                              <TableCell className="text-right">{position.volume.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{position.entryPrice.toFixed(5)}</TableCell>
                              <TableCell className="text-right">{position.closePrice.toFixed(5)}</TableCell>
                              <TableCell className={`text-right font-semibold ${
                                position.profit > 0 ? "text-green-400" : position.profit < 0 ? "text-red-400" : "text-muted-foreground"
                              }`}>
                                ${position.profit.toFixed(2)}
                              </TableCell>
                    </TableRow>
                          );
                        })}
                </TableBody>
              </Table>
            </div>
                  {parsedPositions.length > 20 && (
                    <div className="p-4 text-center text-sm text-muted-foreground border-t border-slate-700">
                      Showing first 20 of {parsedPositions.length} positions
                    </div>
                  )}
                </div>
            </div>
          </CardContent>
        </Card>
        </>
      )}

      {/* Import Summary */}
      {importSummary && (
        <Card className="border-border/50 shadow-lg bg-slate-800">
          <CardHeader>
            <CardTitle>Import Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-4 flex-wrap">
                {importSummary.imported > 0 && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">Imported: {importSummary.imported}</span>
                    </div>
                  )}
                  {importSummary.skippedDuplicates > 0 && (
                    <div className="flex items-center gap-2 text-yellow-400">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-semibold">Skipped duplicates: {importSummary.skippedDuplicates}</span>
                  </div>
                )}
                {importSummary.failed > 0 && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-5 w-5" />
                      <span className="font-semibold">Failed: {importSummary.failed}</span>
                  </div>
                )}
              </div>

              {importSummary.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-semibold">Errors:</p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {importSummary.errors.slice(0, 10).map((error, idx) => (
                            <li key={idx}>
                              Row {error.index + 1}: {error.error instanceof Error ? error.error.message : String(error.error)}
                            </li>
                        ))}
                      </ul>
                      {importSummary.errors.length > 10 && (
                        <p className="text-xs mt-2">... and {importSummary.errors.length - 10} more errors</p>
                      )}
                    </div>
                </AlertDescription>
              </Alert>
            )}
              </div>

              {importSummary.imported > 0 && (
                <div className="pt-4">
                  <Button onClick={() => navigate("/trades")} className="bg-gradient-primary hover:opacity-90">
                    View Trades
                  </Button>
                </div>
              )}
              </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
