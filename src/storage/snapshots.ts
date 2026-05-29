import { ProjectStorage } from './ProjectStorage';
import { Snapshot, SnapshotIndex } from './schemas';

// Simple fast string hashing for local checks
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

const RETENTION_CAP = 50; // Strict FIFO limit of 50 snapshots per chapter

export async function takeSnapshot(
  storage: ProjectStorage,
  chapterId: string,
  type: Snapshot['type'],
  label?: string,
  explicitContent?: string,
  projectId?: string
): Promise<void> {
  const prefix = projectId ? `projects/${projectId}/` : '';
  const contentPath = `${prefix}Artifacts/chapter-${chapterId}.md`;
  const markdown = explicitContent !== undefined ? explicitContent : (await storage.readFile(contentPath) || '');

  const contentHash = simpleHash(markdown);
  const createdAt = new Date().toISOString();
  const id = `${createdAt.replace(/:/g, '-')}-${type}`;

  const indexPath = `${prefix}.history/Artifacts/chapter-${chapterId}/index.json`;
  let indexData: SnapshotIndex = { snapshots: [] };

  if (await storage.exists(indexPath)) {
    const indexStr = await storage.readFile(indexPath);
    if (indexStr) {
      try {
        indexData = JSON.parse(indexStr);
      } catch {
        console.error('Failed to parse snapshot index');
      }
    }
  }

  // Avoid duplicate identical snapshots
  if (indexData.snapshots.length > 0) {
    const lastSnap = indexData.snapshots[indexData.snapshots.length - 1];
    if (lastSnap.contentHash === contentHash && type === 'interval') {
      // Don't save identical interval snapshots
      return;
    }
  }

  // Save the snapshot file itself
  const snapFilePath = `${prefix}.history/Artifacts/chapter-${chapterId}/${id}.md`;
  await storage.writeFile(snapFilePath, markdown);

  // Update index
  indexData.snapshots.push({
    id,
    type,
    label,
    createdAt,
    byteSize: new Blob([markdown]).size,
    contentHash,
  });

  // Strict uniform FIFO pruning: cap the number of snapshots to 50 across ALL types.
  if (indexData.snapshots.length > RETENTION_CAP) {
    const overflowCount = indexData.snapshots.length - RETENTION_CAP;
    const toPrune = indexData.snapshots.slice(0, overflowCount);
    
    // Filter index snapshots list
    const keepList = [];
    for (const snap of indexData.snapshots) {
      const match = toPrune.find(p => p.id === snap.id);
      if (match) {
        // Delete snapshot file from IndexedDB
        const prunePath = `${prefix}.history/Artifacts/chapter-${chapterId}/${snap.id}.md`;
        await storage.deleteFile(prunePath).catch(() => {});
      } else {
        keepList.push(snap);
      }
    }
    indexData.snapshots = keepList;
  }

  await storage.writeFile(indexPath, JSON.stringify(indexData));
}

export async function listSnapshots(
  storage: ProjectStorage,
  chapterId: string,
  projectId?: string
): Promise<SnapshotIndex['snapshots']> {
  const prefix = projectId ? `projects/${projectId}/` : '';
  const indexPath = `${prefix}.history/Artifacts/chapter-${chapterId}/index.json`;
  if (!(await storage.exists(indexPath))) {
    return [];
  }
  const indexStr = await storage.readFile(indexPath);
  if (!indexStr) return [];
  try {
    const indexData: SnapshotIndex = JSON.parse(indexStr);
    return indexData.snapshots;
  } catch {
    return [];
  }
}

export async function readSnapshot(
  storage: ProjectStorage,
  chapterId: string,
  snapshotId: string,
  projectId?: string
): Promise<string | null> {
  const prefix = projectId ? `projects/${projectId}/` : '';
  const snapFilePath = `${prefix}.history/Artifacts/chapter-${chapterId}/${snapshotId}.md`;
  return await storage.readFile(snapFilePath);
}

export async function restoreSnapshot(
  storage: ProjectStorage,
  chapterId: string,
  snapshotId: string,
  projectId?: string
): Promise<string> {
  const prefix = projectId ? `projects/${projectId}/` : '';
  // First, take a pre-restore snapshot of the current content before we replace it
  await takeSnapshot(storage, chapterId, 'pre-restore', `Pre-restore roll back of ${snapshotId}`, undefined, projectId);

  // Fetch snapshot content
  const snapFilePath = `${prefix}.history/Artifacts/chapter-${chapterId}/${snapshotId}.md`;
  const snapContent = await storage.readFile(snapFilePath);
  if (snapContent === null) {
    throw new Error('Snapshot file not found');
  }

  // Overwrite active chapter
  const contentPath = `${prefix}Artifacts/chapter-${chapterId}.md`;
  await storage.writeFile(contentPath, snapContent);
  return snapContent;
}
