import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Loader2 } from "lucide-react";

interface PostImportDialogProps {
  isOpen: boolean;
  jobId: string;
  onSave: (name: string) => Promise<void>;
  onSkip: () => void;
}

export function PostImportDialog({
  isOpen,
  jobId,
  onSave,
  onSkip,
}: PostImportDialogProps) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      setIsSaving(true);
      await onSave(name);
    } catch (e) {
      console.error("Failed to save name", e);
      // Ideally handle error UI here or let parent handle it
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { }}>
      <DialogContent className="w-[90vw] max-w-[600px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Graph Generated Successfully!</DialogTitle>
          <DialogDescription>
            Your graph has been generated with ID: <span className="font-mono text-xs bg-muted px-1 rounded">{jobId}</span>.
            <br />
            Would you like to give it a memorable name?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="graph-name">Graph Name</Label>
            <Input
              id="graph-name"
              placeholder="e.g., Amazon Co-purchase Network"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={isSaving}
          >
            Skip for now
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
