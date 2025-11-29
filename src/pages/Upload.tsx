import { useState, useRef } from 'react';
import { AlertCircle, CheckCircle, FolderOpen } from 'lucide-react';
import { parseWhatsAppChat } from '../utils/whatsappParser';
import { addChats, getAllRules, getAllChats, removeDuplicateChats } from '../services/db';
import { ProcessingStatus } from '../types';
import type { Chat } from '../types';
import { startProcessing, onProgress, type QueueStats } from '../services/processingQueue';

interface FolderChat {
  folderName: string;
  file: File;
}

export default function Upload() {
  const [isDragging, setIsDragging] = useState(false);
  const [folderCount, setFolderCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    
    const items = e.dataTransfer.items;
    const folderChats: FolderChat[] = [];
    
    // Process dropped items to find folders with .txt files
    const processEntry = async (entry: FileSystemEntry, parentPath: string = ''): Promise<void> => {
      if (entry.isDirectory) {
        const dirReader = (entry as FileSystemDirectoryEntry).createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve) => {
          dirReader.readEntries((entries) => resolve(entries));
        });
        
        for (const childEntry of entries) {
          await processEntry(childEntry, entry.name);
        }
      } else if (entry.isFile && entry.name.endsWith('.txt')) {
        const file = await new Promise<File>((resolve) => {
          (entry as FileSystemFileEntry).file((file) => resolve(file));
        });
        
        // Use parent folder name as chat identifier
        const folderName = parentPath || entry.name.replace('.txt', '');
        folderChats.push({ folderName, file });
      }
    };
    
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) {
        await processEntry(entry);
      }
    }
    
    if (folderChats.length > 0) {
      await processFolderChats(folderChats);
    } else {
      setParseError('No .txt files found in the dropped folders. Make sure each subfolder contains a WhatsApp export .txt file.');
    }
  }

  async function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Group files by their parent folder
    const folderMap = new Map<string, File>();
    
    console.log('Total files found:', files.length);
    
    for (const file of Array.from(files)) {
      console.log('File:', file.name, 'Path:', file.webkitRelativePath);
      
      if (!file.name.endsWith('.txt')) continue;
      
      // webkitRelativePath gives us "rootFolder/chatSubfolder/file.txt"
      // or could be "rootFolder/file.txt" if .txt is directly in root
      const pathParts = file.webkitRelativePath.split('/');
      
      console.log('Path parts:', pathParts);
      
      // Get the immediate parent folder name (subfolder containing the .txt)
      // If path is "root/subfolder/file.txt" -> use "subfolder"
      // If path is "root/file.txt" -> use "root"
      if (pathParts.length >= 2) {
        // Use the folder directly containing the .txt file
        const folderName = pathParts[pathParts.length - 2];
        console.log('Using folder name:', folderName);
        folderMap.set(folderName, file);
      }
    }
    
    console.log('Folder map size:', folderMap.size);
    
    const folderChats: FolderChat[] = Array.from(folderMap.entries()).map(
      ([folderName, file]) => ({ folderName, file })
    );
    
    if (folderChats.length > 0) {
      await processFolderChats(folderChats);
    } else {
      setParseError(`No valid chat folders found. Found ${files.length} files but none were .txt files in subfolders.`);
    }
  }

  async function processFolderChats(folderChats: FolderChat[]) {
    setIsProcessing(true);
    setParseError(null);
    setUploadSuccess(false);
    setDuplicateCount(0);
    setFolderCount(folderChats.length);

    try {
      const chats: Chat[] = [];
      const existingChats = await getAllChats();
      const existingKeys = new Set(
        existingChats
          .map((chat) => chat.fileName?.trim().toLowerCase())
          .filter((name): name is string => Boolean(name))
      );
      let duplicatesSkipped = 0;
      
      for (const { folderName, file } of folderChats) {
        const content = await file.text();
        console.log('Parsing chat:', folderName, 'Content length:', content.length);
        console.log('First 500 chars:', content.substring(0, 500));
        
        const parsed = parseWhatsAppChat(content, folderName);
        console.log('Parsed result:', parsed ? `${parsed.messages.length} messages` : 'null');
        
        if (parsed && parsed.messages.length > 0) {
          const normalizedName = folderName.trim().toLowerCase();
          if (existingKeys.has(normalizedName)) {
            duplicatesSkipped++;
            continue;
          }
          existingKeys.add(normalizedName);
          chats.push({
            ...parsed,
            status: ProcessingStatus.PENDING,
          });
        }
      }

      setDuplicateCount(duplicatesSkipped);

      if (chats.length === 0) {
        if (duplicatesSkipped > 0) {
          setParseError('All selected chats were already imported. No new chats added.');
        } else {
          setParseError('No valid WhatsApp chats found in the selected folders');
        }
        return;
      }

      // Save to database
      await addChats(chats);
      
      // Start processing
      const rules = await getAllRules();
      
      // Set up progress tracking
      onProgress((stats) => {
        setQueueStats(stats);
      });
      
      // Start processing in background
      startProcessing(rules);
      
      setUploadSuccess(true);
      setTimeout(() => {
        setFolderCount(0);
        if (folderInputRef.current) {
          folderInputRef.current.value = '';
        }
      }, 3000);
      
    } catch (error: any) {
      setParseError(error.message || 'Failed to process folders');
      console.error('Upload error:', error);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRemoveDuplicates() {
    if (!confirm('Remove duplicate chats based on folder name?')) {
      return;
    }

    setIsCleaningDuplicates(true);
    setCleanupMessage(null);

    try {
      const removed = await removeDuplicateChats();
      if (removed === 0) {
        setCleanupMessage('No duplicate chats were found.');
      } else {
        setCleanupMessage(`Removed ${removed} duplicate chat${removed === 1 ? '' : 's'}.`);
      }
    } catch (error: any) {
      setCleanupMessage(error.message || 'Failed to remove duplicates.');
    } finally {
      setIsCleaningDuplicates(false);
    }
  }

  function handleBrowseClick() {
    folderInputRef.current?.click();
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Data</h1>
      <p className="text-gray-600 mb-8">
        Select a folder containing subfolders with WhatsApp chat exports (.txt files)
      </p>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`card border-2 border-dashed transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="text-center py-12">
          <FolderOpen
            size={64}
            className={`mx-auto mb-4 ${
              isDragging ? 'text-blue-500' : 'text-gray-400'
            }`}
          />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Drag & drop a folder here
          </h3>
          <p className="text-gray-600 mb-4">or</p>
          <button onClick={handleBrowseClick} className="btn-primary">
            Select Folder
          </button>
          <input
            ref={folderInputRef}
            type="file"
            /* @ts-expect-error webkitdirectory is not in types */
            webkitdirectory=""
            directory=""
            onChange={handleFolderSelect}
            className="hidden"
          />
          <p className="text-sm text-gray-500 mt-4">
            Each subfolder should contain one .txt WhatsApp export file
          </p>
        </div>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="mt-6 card bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <p className="text-blue-900">
              Processing {folderCount} chat folder(s)...
            </p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {uploadSuccess && (
        <div className="mt-6 card bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
            <div className="flex-1">
              <p className="text-green-900 font-medium mb-1">
                Successfully uploaded {folderCount} chat(s)!
              </p>
              <p className="text-sm text-green-700">
                Analysis started. Check the Dashboard for progress and results.
              </p>
              {duplicateCount > 0 && (
                <p className="text-sm text-green-700 mt-2">
                  Skipped {duplicateCount} duplicate chat{duplicateCount === 1 ? '' : 's'} that were already in your workspace.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Queue Stats - Show when processing is active */}
      {queueStats && queueStats.isProcessing && (
        <div className="mt-6 card bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <h3 className="font-semibold text-blue-900">Processing Chats...</h3>
            </div>
            <span className="text-lg font-bold text-blue-700">
              {queueStats.total > 0 
                ? Math.round(((queueStats.processed + queueStats.failed) / queueStats.total) * 100) 
                : 0}%
            </span>
          </div>
          
          <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden mb-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${queueStats.total > 0 
                  ? ((queueStats.processed + queueStats.failed) / queueStats.total) * 100 
                  : 0}%`,
              }}
            />
          </div>
          
          <div className="flex justify-between text-sm text-blue-700">
            <span>{queueStats.pending} pending</span>
            <span>{queueStats.processed} done • {queueStats.failed} failed</span>
          </div>
        </div>
      )}

      {/* Duplicate cleanup */}
      <div className="mt-6 card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Duplicate Protection</h3>
            <p className="text-sm text-gray-600">
              Uploads automatically skip chats with the same folder name. Use the cleanup button to remove any duplicates already stored.
            </p>
          </div>
          <button
            onClick={handleRemoveDuplicates}
            className="btn-secondary self-start sm:self-auto"
            disabled={isCleaningDuplicates}
          >
            {isCleaningDuplicates ? 'Removing duplicates...' : 'Remove duplicates'}
          </button>
        </div>
        {cleanupMessage && (
          <p className="mt-3 text-sm text-gray-700">{cleanupMessage}</p>
        )}
      </div>

      {/* Error Message */}
      {parseError && (
        <div className="mt-6 card bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
            <div>
              <p className="text-red-900 font-medium mb-1">Upload Failed</p>
              <p className="text-sm text-red-700">{parseError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 card bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-4">How to organize your chat exports:</h3>
        <ol className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="font-semibold">1.</span>
            <span>Create a main folder for all your chats (e.g., "WhatsApp Exports")</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">2.</span>
            <span>Inside, create a subfolder for each chat (e.g., "Cliente João", "Cliente Maria")</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">3.</span>
            <span>Place the exported .txt file inside each subfolder</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">4.</span>
            <span>Select the main folder here - all subfolders will be imported automatically</span>
          </li>
        </ol>
        
        <div className="mt-4 p-3 bg-white rounded border border-gray-200">
          <p className="text-xs font-mono text-gray-600">
            📁 WhatsApp Exports/<br/>
            &nbsp;&nbsp;&nbsp;├── 📁 Cliente João/<br/>
            &nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📄 chat.txt<br/>
            &nbsp;&nbsp;&nbsp;├── 📁 Cliente Maria/<br/>
            &nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📄 conversa.txt<br/>
            &nbsp;&nbsp;&nbsp;└── 📁 Cliente Pedro/<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📄 export.txt
          </p>
        </div>

        <h4 className="font-semibold text-gray-900 mt-6 mb-3">How to export from WhatsApp:</h4>
        <ol className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="font-semibold">1.</span>
            <span>Open WhatsApp → Open the chat → Tap chat name at top</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">2.</span>
            <span>Scroll down → "Export Chat" → "Without Media"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">3.</span>
            <span>Save the .txt file to the appropriate subfolder</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
