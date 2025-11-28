import { useState, useRef } from 'react';
import { Upload as UploadIcon, AlertCircle, CheckCircle } from 'lucide-react';
import { parseWhatsAppChats } from '../utils/whatsappParser';
import { addChats, getAllRules } from '../services/db';
import { ProcessingStatus } from '../types';
import type { Chat } from '../types';
import { startProcessing, onProgress, type QueueStats } from '../services/processingQueue';

export default function Upload() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.name.endsWith('.txt')
    );
    
    if (files.length > 0) {
      await processFiles(files);
    } else {
      setParseError('Please drop .txt files only');
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFiles(Array.from(files));
    }
  }

  async function processFiles(files: File[]) {
    setIsProcessing(true);
    setParseError(null);
    setUploadSuccess(false);
    setUploadedFiles(files);

    try {
      // Parse files
      const parsedChats = await parseWhatsAppChats(files);
      
      if (parsedChats.length === 0) {
        setParseError('No valid WhatsApp chats found in the selected files');
        return;
      }

      // Convert to Chat objects with pending status
      const chats: Chat[] = parsedChats.map((parsed) => ({
        ...parsed,
        status: ProcessingStatus.PENDING,
      }));

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
        setUploadedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 3000);
      
    } catch (error: any) {
      setParseError(error.message || 'Failed to process files');
      console.error('Upload error:', error);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleBrowseClick() {
    fileInputRef.current?.click();
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Data</h1>
      <p className="text-gray-600 mb-8">
        Upload your WhatsApp chat export files (.txt format) to analyze
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
          <UploadIcon
            size={64}
            className={`mx-auto mb-4 ${
              isDragging ? 'text-blue-500' : 'text-gray-400'
            }`}
          />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Drag & drop your files here
          </h3>
          <p className="text-gray-600 mb-4">or</p>
          <button onClick={handleBrowseClick} className="btn-primary">
            Browse Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          <p className="text-sm text-gray-500 mt-4">
            Supports multiple .txt files (WhatsApp export format)
          </p>
        </div>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="mt-6 card bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <p className="text-blue-900">
              Processing {uploadedFiles.length} file(s)...
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
                Successfully uploaded {uploadedFiles.length} file(s)!
              </p>
              <p className="text-sm text-green-700">
                Analysis started. Check the Dashboard for progress and results.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Queue Stats */}
      {queueStats && queueStats.pending > 0 && (
        <div className="mt-6 card">
          <h3 className="font-semibold text-gray-900 mb-4">Processing Queue</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total:</span>
              <span className="font-medium">{queueStats.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Processed:</span>
              <span className="font-medium text-green-600">{queueStats.processed}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Pending:</span>
              <span className="font-medium text-blue-600">{queueStats.pending}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Failed:</span>
              <span className="font-medium text-red-600">{queueStats.failed}</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(queueStats.processed / queueStats.total) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

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
        <h3 className="font-semibold text-gray-900 mb-4">How to export WhatsApp chats:</h3>
        <ol className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="font-semibold">1.</span>
            <span>Open WhatsApp on your phone</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">2.</span>
            <span>Open the chat you want to analyze</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">3.</span>
            <span>Tap on the chat name/group name at the top</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">4.</span>
            <span>Scroll down and tap "Export Chat"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">5.</span>
            <span>Choose "Without Media" and save the .txt file</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">6.</span>
            <span>Upload the file here</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
