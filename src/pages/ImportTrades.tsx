import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { calculateAllMetrics } from "@/lib/tradeCalculations";
import { useAuth } from "@/contexts/AuthContext";

type ParsedRow = Record<string, any>;

const FIELD_MAPPINGS = [
  { key: "trading_day", label: "Trading Day", required: true },
  { key: "opened_at", label: "Opened At", required: true },
  { key: "symbol", label: "Instrument Symbol", required: true },
  { key: "side", label: "Side (long/short)", required: true },
  { key: "order_type", label: "Order Type", required: true },
  { key: "size_lots", label: "Size (Lots)", required: true },
  { key: "entry_price", label: "Entry Price", required: true },
  { key: "stop_loss_price", label: "Stop Loss Price", required: true },
  { key: "exit_price", label: "Exit Price", required: false },
  { key: "closed_at", label: "Closed At", required: false },
  { key: "tp1_price", label: "TP1 Price", required: false },
  { key: "tp2_price", label: "TP2 Price", required: false },
  { key: "tp3_price", label: "TP3 Price", required: false },
  { key: "strategy", label: "Strategy Name", required: false },
  { key: "session", label: "Session Name", required: false },
  { key: "account_type", label: "Account Type", required: false },
  { key: "risk_percent", label: "Risk %", required: false },
  { key: "notes", label: "Notes", required: false },
];

export default function ImportTrades() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "map" | "preview" | "complete">("upload");
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: [],
  });

  const { data: instruments } = useQuery({
    queryKey: ["instruments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("instruments").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: strategies } = useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("strategies").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions").select("*");
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const fileExtension = uploadedFile.name.split(".").pop()?.toLowerCase();

    try {
      if (fileExtension === "csv") {
        Papa.parse(uploadedFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setParsedData(results.data as ParsedRow[]);
            autoMapColumns(Object.keys((results.data as ParsedRow[])[0] || {}));
            setStep("map");
          },
          error: (error) => {
            toast({
              title: "Parse Error",
              description: error.message,
              variant: "destructive",
            });
          },
        });
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        const data = await uploadedFile.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as ParsedRow[];
        setParsedData(jsonData);
        autoMapColumns(Object.keys(jsonData[0] || {}));
        setStep("map");
      } else {
        toast({
          title: "Invalid File",
          description: "Please upload a CSV or XLSX file",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse file",
        variant: "destructive",
      });
    }
  };

  const autoMapColumns = (fileColumns: string[]) => {
    const mapping: Record<string, string> = {};
    
    fileColumns.forEach((col) => {
      const normalized = col.toLowerCase().replace(/[_\s]/g, "");
      
      if (normalized.includes("date") || normalized.includes("day")) mapping["trading_day"] = col;
      if (normalized.includes("opened") || normalized.includes("opentime")) mapping["opened_at"] = col;
      if (normalized.includes("symbol") || normalized.includes("instrument")) mapping["symbol"] = col;
      if (normalized.includes("side") || normalized.includes("direction")) mapping["side"] = col;
      if (normalized.includes("ordertype") || normalized.includes("type")) mapping["order_type"] = col;
      if (normalized.includes("size") || normalized.includes("lots") || normalized.includes("volume")) mapping["size_lots"] = col;
      if (normalized.includes("entry") || normalized.includes("open")) mapping["entry_price"] = col;
      if (normalized.includes("stoploss") || normalized.includes("sl")) mapping["stop_loss_price"] = col;
      if (normalized.includes("exit") || normalized.includes("close")) mapping["exit_price"] = col;
      if (normalized.includes("closed") || normalized.includes("closetime")) mapping["closed_at"] = col;
      if (normalized.includes("tp1")) mapping["tp1_price"] = col;
      if (normalized.includes("tp2")) mapping["tp2_price"] = col;
      if (normalized.includes("tp3")) mapping["tp3_price"] = col;
      if (normalized.includes("strategy")) mapping["strategy"] = col;
      if (normalized.includes("session")) mapping["session"] = col;
      if (normalized.includes("account")) mapping["account_type"] = col;
      if (normalized.includes("risk")) mapping["risk_percent"] = col;
      if (normalized.includes("note")) mapping["notes"] = col;
    });

    setColumnMapping(mapping);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const results = { success: 0, failed: 0, errors: [] as string[] };
      
      for (let i = 0; i < parsedData.length; i++) {
        try {
          const row = parsedData[i];
          const mappedData: Record<string, any> = {};

          // Map columns
          Object.entries(columnMapping).forEach(([key, fileColumn]) => {
            if (fileColumn && row[fileColumn] !== undefined && row[fileColumn] !== "") {
              mappedData[key] = row[fileColumn];
            }
          });

          // Find instrument by symbol
          const instrument = instruments?.find(
            (i) => i.symbol.toLowerCase() === mappedData.symbol?.toLowerCase()
          );
          if (!instrument) {
            results.errors.push(`Row ${i + 1}: Instrument ${mappedData.symbol} not found`);
            results.failed++;
            continue;
          }

          // Find strategy by name (if provided)
          let strategyId = null;
          if (mappedData.strategy) {
            const strategy = strategies?.find(
              (s) => s.name.toLowerCase() === mappedData.strategy.toLowerCase()
            );
            strategyId = strategy?.id || null;
          }

          // Find session by name (if provided)
          let sessionId = null;
          if (mappedData.session) {
            const session = sessions?.find(
              (s) => s.name.toLowerCase() === mappedData.session.toLowerCase()
            );
            sessionId = session?.id || null;
          }

          // Prepare trade data
          const entryPrice = parseFloat(mappedData.entry_price);
          const stopLossPrice = parseFloat(mappedData.stop_loss_price);
          const exitPrice = mappedData.exit_price ? parseFloat(mappedData.exit_price) : null;
          const sizeLots = parseFloat(mappedData.size_lots);
          const side = mappedData.side?.toLowerCase() === "long" ? "long" : "short";

          // Calculate metrics
          const metrics = calculateAllMetrics({
            side,
            entryPrice,
            stopLossPrice,
            exitPrice,
            tp1Price: mappedData.tp1_price ? parseFloat(mappedData.tp1_price) : undefined,
            tp2Price: mappedData.tp2_price ? parseFloat(mappedData.tp2_price) : undefined,
            tp3Price: mappedData.tp3_price ? parseFloat(mappedData.tp3_price) : undefined,
            sizeLots,
          });

          // Insert trade
          const { error } = await supabase.from("trades").insert({
            user_id: user.id,
            trading_day: mappedData.trading_day,
            opened_at: mappedData.opened_at,
            closed_at: mappedData.closed_at || null,
            instrument_id: instrument.id,
            strategy_id: strategyId,
            session_id: sessionId,
            side,
            order_type: mappedData.order_type?.toLowerCase() || "market",
            size_lots: sizeLots,
            entry_price: entryPrice,
            stop_loss_price: stopLossPrice,
            exit_price: exitPrice,
            tp1_price: mappedData.tp1_price ? parseFloat(mappedData.tp1_price) : null,
            tp2_price: mappedData.tp2_price ? parseFloat(mappedData.tp2_price) : null,
            tp3_price: mappedData.tp3_price ? parseFloat(mappedData.tp3_price) : null,
            account_type: mappedData.account_type?.toLowerCase() || "demo",
            risk_percent: mappedData.risk_percent ? parseFloat(mappedData.risk_percent) : null,
            notes: mappedData.notes || null,
            ...metrics,
          });

          if (error) {
            results.errors.push(`Row ${i + 1}: ${error.message}`);
            results.failed++;
          } else {
            results.success++;
          }
        } catch (error) {
          results.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
          results.failed++;
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setImportResults(results);
      setStep("complete");
      toast({
        title: "Import Complete",
        description: `${results.success} trades imported successfully${results.failed > 0 ? `, ${results.failed} failed` : ""}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    const requiredFields = FIELD_MAPPINGS.filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => !columnMapping[f.key]);

    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please map: ${missingFields.map((f) => f.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setStep("preview");
  };

  const confirmImport = () => {
    importMutation.mutate();
  };

  const reset = () => {
    setFile(null);
    setParsedData([]);
    setColumnMapping({});
    setStep("upload");
    setImportResults({ success: 0, failed: 0, errors: [] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Trades</h1>
        <p className="text-muted-foreground mt-1">
          Import trades from CSV or XLSX files
        </p>
      </div>

      {step === "upload" && (
        <Card className="border-border/50 shadow-card bg-gradient-card">
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Upload a CSV or XLSX file containing your trade data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <Label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-background/50 hover:bg-background/80 transition-colors border-border/50"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-12 h-12 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">CSV or XLSX files</p>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                />
              </Label>
            </div>

            {file && (
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  {file.name} ({parsedData.length} rows)
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {step === "map" && (
        <Card className="border-border/50 shadow-card bg-gradient-card">
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>
              Map your file columns to trade fields. Required fields are marked with *
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {FIELD_MAPPINGS.map((field) => (
              <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                <Label>
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={columnMapping[field.key] || ""}
                  onValueChange={(value) =>
                    setColumnMapping((prev) => ({ ...prev, [field.key]: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {Object.keys(parsedData[0] || {}).map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button onClick={handleImport} className="bg-gradient-primary hover:opacity-90">
                Preview Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card className="border-border/50 shadow-card bg-gradient-card">
          <CardHeader>
            <CardTitle>Preview Import</CardTitle>
            <CardDescription>
              Review the first 5 rows before importing {parsedData.length} trades
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/50 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>SL</TableHead>
                    <TableHead>Exit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 5).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row[columnMapping.trading_day || ""]}</TableCell>
                      <TableCell>{row[columnMapping.symbol || ""]}</TableCell>
                      <TableCell>{row[columnMapping.side || ""]}</TableCell>
                      <TableCell>{row[columnMapping.entry_price || ""]}</TableCell>
                      <TableCell>{row[columnMapping.stop_loss_price || ""]}</TableCell>
                      <TableCell>{row[columnMapping.exit_price || ""] || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button
                onClick={confirmImport}
                disabled={importMutation.isPending}
                className="bg-gradient-primary hover:opacity-90"
              >
                {importMutation.isPending ? "Importing..." : `Import ${parsedData.length} Trades`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "complete" && (
        <Card className="border-border/50 shadow-card bg-gradient-card">
          <CardHeader>
            <CardTitle>Import Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Successfully imported {importResults.success} trades
              </AlertDescription>
            </Alert>

            {importResults.failed > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {importResults.failed} trades failed to import
                </AlertDescription>
              </Alert>
            )}

            {importResults.errors.length > 0 && (
              <div className="space-y-2">
                <Label>Errors:</Label>
                <div className="text-sm text-muted-foreground space-y-1 max-h-48 overflow-auto">
                  {importResults.errors.slice(0, 10).map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                  {importResults.errors.length > 10 && (
                    <div>... and {importResults.errors.length - 10} more errors</div>
                  )}
                </div>
              </div>
            )}

            <Button onClick={reset} className="w-full">
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
