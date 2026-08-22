import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-context';
import api from '@/lib/api';

export function UpdateSettings({ disabled }: { disabled?: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [checked, setChecked] = useState(false);

  const checkUpdates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/updater/check');
      setUpdateInfo(res.data);
      setChecked(true);
      if (!res.data.update_available) {
         toast("You are on the latest version!", "success");
      }
    } catch (e) {
      toast("Failed to check for updates.", "error");
    } finally {
      setLoading(false);
    }
  };

  const installUpdate = async () => {
    if (!updateInfo?.download_url) return;
    setInstalling(true);
    try {
      toast("Downloading update... This may take a minute.", "success");
      await api.post('/updater/perform', { download_url: updateInfo.download_url });
      toast("Update initiated! The application will now restart.", "success");
    } catch (e) {
      toast("Failed to install the update.", "error");
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-foreground">System Updates</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Keep InvoiceCore up to date with the latest features, bug fixes, and security patches.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
           <div>
             <h3 className="font-semibold text-lg flex items-center gap-2">
                Version Status
             </h3>
             <p className="text-sm text-muted-foreground mt-1">
                Currently running <strong>v2.0.0</strong> (Local Engine)
             </p>
           </div>
           
           <Button 
             onClick={checkUpdates} 
             disabled={disabled || loading || installing}
             variant={updateInfo?.update_available ? "outline" : "default"}
           >
             {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshIcon updateInfo={updateInfo} />}
             {loading ? 'Checking...' : 'Check for Updates'}
           </Button>
        </div>

        {checked && updateInfo && (
           <div className={`mt-6 p-4 border rounded-lg ${updateInfo.update_available ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800' : 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800'}`}>
              <div className="flex items-start gap-4">
                 {updateInfo.update_available ? (
                    <Download className="w-6 h-6 text-blue-500 mt-1" />
                 ) : (
                    <CheckCircle className="w-6 h-6 text-green-500 mt-1" />
                 )}
                 <div className="flex-1">
                    <h4 className="font-bold text-base">
                       {updateInfo.update_available 
                          ? `Update Available: ${updateInfo.latest_version}` 
                          : "InvoiceCore is up to date"}
                    </h4>
                    {updateInfo.update_available && (
                       <>
                          <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-background/50 p-3 rounded border border-border/50">
                             {updateInfo.release_notes || "No release notes provided."}
                          </div>
                          <div className="mt-4 flex gap-3">
                             <Button onClick={installUpdate} disabled={disabled || installing} className="w-full sm:w-auto">
                                {installing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                {installing ? "Downloading & Installing..." : "Download & Install Update"}
                             </Button>
                          </div>
                       </>
                    )}
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}

function RefreshIcon({ updateInfo }: any) {
  if (!updateInfo) return <Download className="w-4 h-4 mr-2" />;
  if (updateInfo.update_available) return <Download className="w-4 h-4 mr-2" />;
  return <CheckCircle className="w-4 h-4 mr-2" />;
}
