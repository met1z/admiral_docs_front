import { useEffect, useRef, useState } from 'react';

import { CheckCircle2, History, Loader2, MessageSquareText, Search, Send, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { DocumentPreview } from '@/components/documents/document-preview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { useToast } from '@/components/ui/toast';
import { useDocumentsMeta } from '@/features/documents/documents-meta-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { buildDocumentPreviewSource } from '@/lib/document-preview-source';
import {
  requestJson,
  type DocumentDetailComment,
  type DocumentDetailHistoryItem,
  type DocumentDetailResponse,
  type DocumentStorageUploadResponse,
  type UserSearchItem,
} from '@/lib/http';

type AdditionalApproverNode = {
  id: number;
  userId: number;
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  fullName: string;
  signedStatus: DocumentDetailResponse['participants'][number]['signedStatus'];
};

function formatDateTime(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function buildFullName(firstName: string | null, lastName: string | null, fallback: string | null = '—') {
  return [firstName, lastName].filter(Boolean).join(' ') || fallback;
}

function fileIsSupported(file: File) {
  const allowedMimeTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ]);

  const allowedExtensions = ['pdf', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  return allowedMimeTypes.has(file.type) || allowedExtensions.includes(extension);
}

function statusLabel(status: DocumentDetailResponse['status'], t: (key: string) => string) {
  if (status === 'completed') {
    return t('documents.status.completed');
  }

  if (status === 'refunded') {
    return t('documents.status.refunded');
  }

  if (status === 'rejected') {
    return t('documents.status.rejected');
  }

  return t('documents.status.inProgress');
}

function participantStatusLabel(
  status: DocumentDetailResponse['participants'][number]['signedStatus'],
  t: (key: string) => string,
) {
  if (status === 'completed') {
    return t('documents.detail.statusSigned');
  }

  if (status === 'rejected') {
    return t('documents.detail.statusRejected');
  }

  return t('documents.detail.statusPending');
}

function participantTypeLabel(
  type: DocumentDetailResponse['participants'][number]['participantType'],
  t: (key: string) => string,
) {
  if (type === 'additional_approver') {
    return t('documents.participantType.additionalApprover');
  }

  return t('documents.participantType.signer');
}

function groupAdditionalApproversByParentParticipant(
  participants: DocumentDetailResponse['participants'],
  history: DocumentDetailHistoryItem[],
) {
  const groups = new Map<number, AdditionalApproverNode[]>();
  const parentParticipantIdByUserId = new Map<number, number>();

  for (const event of history) {
    if (event.eventType !== 'sent_for_additional_approval' || event.participantId === null || event.targetUserId === null) {
      continue;
    }

    parentParticipantIdByUserId.set(event.targetUserId, event.participantId);
  }

  for (const participant of participants) {
    if (participant.participantType !== 'additional_approver' || participant.addedByUserId === null) {
      continue;
    }

    const parentParticipantId = parentParticipantIdByUserId.get(participant.userId);

    if (!parentParticipantId) {
      continue;
    }

    const mappedParticipant: AdditionalApproverNode = {
      id: participant.id,
      userId: participant.userId,
      userFirstName: participant.userFirstName,
      userLastName: participant.userLastName,
      userEmail: participant.userEmail,
      fullName:
        buildFullName(participant.userFirstName, participant.userLastName, participant.userEmail) ??
        participant.userEmail ??
        '—',
      signedStatus: participant.signedStatus,
    };

    const existing = groups.get(parentParticipantId) ?? [];
    groups.set(parentParticipantId, [...existing, mappedParticipant]);
  }

  return groups;
}

function formatHistoryDescription(event: DocumentDetailHistoryItem, t: (key: string) => string) {
  const actor = event.actorFullName;
  const target = event.targetFullName;

  switch (event.eventType) {
    case 'created':
      return `${actor} · ${t('documents.detail.eventCreated')}`;
    case 'deleted':
      return `${actor} · ${t('documents.detail.eventDeleted')}`;
    case 'name_replaced':
      return `${actor} · ${t('documents.detail.eventNameReplaced')}`;
    case 'file_replaced':
      return `${actor} · ${t('documents.detail.eventFileReplaced')}`;
    case 'sent_for_signing':
      return `${actor} · ${t('documents.detail.eventSentForSigning')}`;
    case 'signed':
      return `${actor} · ${t('documents.detail.eventSigned')}`;
    case 'sent_for_additional_approval':
      return target
        ? `${actor} · ${t('documents.detail.eventSentForAdditionalApproval')} · ${target}`
        : `${actor} · ${t('documents.detail.eventSentForAdditionalApproval')}`;
    case 'additional_approval_rejected':
      return target
        ? `${actor} · ${t('documents.detail.eventAdditionalApprovalRejected')} · ${target}`
        : `${actor} · ${t('documents.detail.eventAdditionalApprovalRejected')}`;
    case 'additional_approval_accepted':
      return target
        ? `${actor} · ${t('documents.detail.eventAdditionalApprovalAccepted')} · ${target}`
        : `${actor} · ${t('documents.detail.eventAdditionalApprovalAccepted')}`;
    case 'rejected':
      return target ? `${actor} · ${t('documents.detail.eventRejected')} · ${target}` : `${actor} · ${t('documents.detail.eventRejected')}`;
    case 'returned_for_revision':
      return target
        ? `${actor} · ${t('documents.detail.eventReturnedForRevision')} · ${target}`
        : `${actor} · ${t('documents.detail.eventReturnedForRevision')}`;
    case 'resubmitted':
      return `${actor} · ${t('documents.detail.eventResubmitted')}`;
    case 'completed':
      return `${actor} · ${t('documents.detail.eventCompleted')}`;
    case 'comment_added':
      return `${actor} · ${t('documents.detail.eventCommentAdded')}`;
    case 'refunded':
      return `${actor} · ${t('documents.detail.eventRefunded')}`;
    default:
      return `${actor} · ${t('documents.detail.eventUnknown')}`;
  }
}

function historyTone(eventType: DocumentDetailHistoryItem['eventType']) {
  if (eventType === 'rejected' || eventType === 'additional_approval_rejected' || eventType === 'deleted') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  if (eventType === 'completed' || eventType === 'signed' || eventType === 'additional_approval_accepted') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (eventType === 'returned_for_revision' || eventType === 'sent_for_additional_approval' || eventType === 'refunded') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export function DocumentDetailPage() {
  const { t } = useTranslation();
  const { types } = useDocumentsMeta();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();

  const [document, setDocument] = useState<DocumentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [additionalApprovalDialogOpen, setAdditionalApprovalDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementPreview, setReplacementPreview] = useState<string | null>(null);
  const [updatingDocument, setUpdatingDocument] = useState(false);
  const [approvalSearchInput, setApprovalSearchInput] = useState('');
  const [approvalResults, setApprovalResults] = useState<UserSearchItem[]>([]);
  const [approvalSelected, setApprovalSelected] = useState<UserSearchItem[]>([]);
  const [approvalReason, setApprovalReason] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'error' | null>(null);

  const debouncedApprovalSearch = useDebouncedValue(approvalSearchInput, 300);
  const replacementFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      if (!id) {
        setError(t('documents.detail.loadFailed'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await requestJson<DocumentDetailResponse>(`/documents/${id}`, {
          method: 'GET',
        });

        if (!cancelled) {
          setDocument(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('documents.detail.loadFailed'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [id, t]);

  useEffect(() => {
    let cancelled = false;

    async function searchUsers() {
      if (!additionalApprovalDialogOpen) {
        setApprovalResults([]);
        return;
      }

      const query = debouncedApprovalSearch.trim();

      if (query.length < 2) {
        setApprovalResults([]);
        return;
      }

      setApprovalLoading(true);

      try {
        const results = await requestJson<UserSearchItem[]>(
          `/users/search?query=${encodeURIComponent(query)}&limit=8`,
          { method: 'GET' },
        );

        if (!cancelled) {
          const selectedIds = new Set(approvalSelected.map((participant) => participant.id));
          const participantIds = new Set(currentDocument.participants.map((participant) => participant.userId));
          setApprovalResults(results.filter((result) => !selectedIds.has(result.id) && !participantIds.has(result.id)));
        }
      } catch (searchError) {
        if (!cancelled) {
          setApprovalResults([]);
          const description = searchError instanceof Error ? searchError.message : null;
          showToast({
            title: t('documents.detail.additionalApprovalLoadFailed'),
            ...(description ? { description } : {}),
            variant: 'error',
          });
        }
      } finally {
        if (!cancelled) {
          setApprovalLoading(false);
        }
      }
    }

    void searchUsers();

    return () => {
      cancelled = true;
    };
  }, [approvalSelected, additionalApprovalDialogOpen, debouncedApprovalSearch, document?.participants, showToast, t]);

  useEffect(() => {
    if (!document) {
      return;
    }

    setRenameValue(document.name);
    setReplacementFile(null);
    setReplacementPreview(null);
    setActiveTab('comments');
    setCommentDraft('');
  }, [document?.id, document?.name]);

  useEffect(() => {
    const currentFile = document?.currentFile;
    const documentId = document?.id;
    const previewUrl = currentFile?.previewUrl;

    if (!documentId || !currentFile || !previewUrl) {
      setPreviewBlob(null);
      setPreviewStatus(null);
      return;
    }

    const resolvedPreviewUrl = previewUrl;

    const isDocxFile = currentFile.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isDocxFile) {
      setPreviewBlob(null);
      setPreviewStatus(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 15000);

    async function loadPreviewBlob() {
      setPreviewBlob(null);
      setPreviewStatus('loading');

      try {
        const response = await fetch(resolvedPreviewUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Preview request failed: ${response.status}`);
        }

        const blob = await response.blob();

        if (!cancelled) {
          setPreviewBlob(blob);
          setPreviewStatus(null);
        }
      } catch {
        if (!cancelled) {
          setPreviewBlob(null);
          setPreviewStatus('error');
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    void loadPreviewBlob();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [document?.currentFile?.mimeType, document?.id]);

  useEffect(() => {
    if (!replacementFile) {
      setReplacementPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(replacementFile);
    setReplacementPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [replacementFile]);

  if (id && Number.isNaN(Number(id))) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="grid min-h-[calc(100vh-8rem)] place-items-center rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('documents.detail.loading')}
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="grid min-h-[calc(100vh-8rem)] place-items-center rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="max-w-md text-center">
          <Sparkles className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-4 text-sm text-slate-500">{error ?? t('documents.detail.loadFailed')}</p>
        </div>
      </div>
    );
  }

  const currentDocument = document;
  const currentFile = currentDocument.currentFile;
  const sortedParticipants = [...currentDocument.participants].sort((left, right) => left.order - right.order || left.id - right.id);
  const signerParticipants = sortedParticipants.filter((participant) => participant.participantType === 'signer');
  const additionalApproverGroups = groupAdditionalApproversByParentParticipant(sortedParticipants, currentDocument.history);
  const currentActionParticipant = sortedParticipants.find((participant) => participant.isCurrentAction) ?? null;
  const isInitiator = user?.id === currentDocument.createdByUserId;
  const canEditDocument = isInitiator && (currentDocument.status === 'rejected' || currentDocument.status === 'refunded');
  const canResubmit = isInitiator && (currentDocument.status === 'rejected' || currentDocument.status === 'refunded');
  const noParticipantsSigned = currentDocument.participants.every((participant) => participant.signedStatus === 'pending');
  const canRefund = isInitiator && currentDocument.status === 'in_progress' && noParticipantsSigned;
  const canDelete = isInitiator && (currentDocument.status === 'rejected' || currentDocument.status === 'refunded');
  const history = [...currentDocument.history].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();

    return leftTime - rightTime || left.id - right.id;
  });
  const replacementFileError =
    replacementFile && (!fileIsSupported(replacementFile) || replacementFile.size > 40 * 1024 * 1024)
      ? !fileIsSupported(replacementFile)
        ? t('documents.validation.fileType')
        : t('documents.validation.fileSize')
      : null;

  async function refreshDetail(nextDetail: DocumentDetailResponse) {
    setDocument(nextDetail);
  }

  async function handleUpdateDocument() {
    const nextName = renameValue.trim();
    const hasNameChange = nextName !== currentDocument.name;
    const hasFileChange = Boolean(replacementFile);

    if (nextName.length < 3) {
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        description: t('documents.validation.name'),
        variant: 'error',
      });
      return;
    }

    if (!hasNameChange && !hasFileChange) {
      return;
    }

    if (replacementFile && !fileIsSupported(replacementFile)) {
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        description: t('documents.validation.fileType'),
        variant: 'error',
      });
      return;
    }

    if (replacementFile && replacementFile.size > 40 * 1024 * 1024) {
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        description: t('documents.validation.fileSize'),
        variant: 'error',
      });
      return;
    }

    setUpdatingDocument(true);

    try {
      let latestDetail: DocumentDetailResponse | null = null;

      if (hasNameChange) {
        latestDetail = await requestJson<DocumentDetailResponse>(`/documents/${currentDocument.id}/name`, {
          method: 'PATCH',
          body: JSON.stringify({ name: nextName }),
        });
      }

      if (replacementFile) {
        const uploadForm = new FormData();
        uploadForm.append('file', replacementFile);

        const uploadedFile = await requestJson<DocumentStorageUploadResponse>('/documents/storage/upload', {
          method: 'POST',
          body: uploadForm,
        });

        latestDetail = await requestJson<DocumentDetailResponse>(`/documents/${currentDocument.id}/file`, {
          method: 'PATCH',
          body: JSON.stringify({ file: uploadedFile }),
        });
      }

      if (latestDetail) {
        await refreshDetail(latestDetail);
      }

      setReplacementFile(null);
      setEditDialogOpen(false);
      showToast({
        title: t('documents.detail.documentUpdatedTitle'),
        description: t('documents.detail.documentUpdatedDescription'),
        variant: 'success',
      });
    } catch (updateError) {
      const description = updateError instanceof Error ? updateError.message : null;
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        ...(description ? { description } : {}),
        variant: 'error',
      });
    } finally {
      setUpdatingDocument(false);
    }
  }

  async function handleRefundDocument() {
    if (!canRefund) {
      return;
    }

    setRefunding(true);

    try {
      const response = await requestJson<DocumentDetailResponse>(`/documents/${currentDocument.id}/refund`, {
        method: 'POST',
      });

      await refreshDetail(response);
      showToast({
        title: t('documents.detail.refundDocumentSuccessTitle'),
        description: t('documents.detail.refundDocumentSuccessDescription'),
        variant: 'success',
      });
    } catch (refundError) {
      const description = refundError instanceof Error ? refundError.message : null;
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        ...(description ? { description } : {}),
        variant: 'error',
      });
    } finally {
      setRefunding(false);
    }
  }

  async function handleDeleteDocument() {
    if (!canDelete) {
      return;
    }

    setDeletingDocument(true);

    try {
      await requestJson<{ deleted: true }>(`/documents/${currentDocument.id}`, {
        method: 'DELETE',
      });

      showToast({
        title: t('documents.detail.deleteDocumentSuccessTitle'),
        description: t('documents.detail.deleteDocumentSuccessDescription'),
        variant: 'success',
      });
      navigate('/', { replace: true });
    } catch (deleteError) {
      const description = deleteError instanceof Error ? deleteError.message : null;
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        ...(description ? { description } : {}),
        variant: 'error',
      });
    } finally {
      setDeletingDocument(false);
      setDeleteDialogOpen(false);
    }
  }

  async function handleSign() {
    if (!currentActionParticipant) {
      return;
    }

    setSigning(true);

    try {
      const response = await requestJson<DocumentDetailResponse>(
        `/documents/${currentDocument.id}/participants/${currentActionParticipant.id}/sign`,
        { method: 'POST' },
      );

      await refreshDetail(response);
      showToast({
        title: t('documents.detail.signSuccessTitle'),
        description: t('documents.detail.signSuccessDescription'),
        variant: 'success',
      });
    } catch (signError) {
      const description = signError instanceof Error ? signError.message : null;
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        ...(description ? { description } : {}),
        variant: 'error',
      });
    } finally {
      setSigning(false);
    }
  }

  async function handleReject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentActionParticipant) {
      return;
    }

    const reason = rejectReason.trim();
    if (reason.length < 3) {
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        description: t('documents.detail.rejectReasonRequired'),
        variant: 'error',
      });
      return;
    }

    setRejecting(true);

    try {
      const response = await requestJson<DocumentDetailResponse>(
        `/documents/${currentDocument.id}/participants/${currentActionParticipant.id}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        },
      );

      await refreshDetail(response);
      setRejectReason('');
      showToast({
        title: t('documents.detail.rejectSuccessTitle'),
        description: t('documents.detail.rejectSuccessDescription'),
        variant: 'success',
      });
    } catch (rejectError) {
      const description = rejectError instanceof Error ? rejectError.message : null;
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        ...(description ? { description } : {}),
        variant: 'error',
      });
    } finally {
      setRejecting(false);
    }
  }

  function addApprover(user: UserSearchItem) {
    setApprovalSelected((current) => {
      if (current.some((participant) => participant.id === user.id)) {
        return current;
      }

      return [...current, user];
    });
    setApprovalSearchInput('');
    setApprovalResults([]);
  }

  function removeApprover(userId: number) {
    setApprovalSelected((current) => current.filter((participant) => participant.id !== userId));
  }

  async function handleAdditionalApproval(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentActionParticipant) {
      return;
    }

    if (approvalSelected.length === 0) {
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        description: t('documents.detail.additionalApprovalRequired'),
        variant: 'error',
      });
      return;
    }

    const reason = approvalReason.trim();

    if (reason.length < 3) {
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        description: t('documents.detail.additionalApprovalReasonRequired'),
        variant: 'error',
      });
      return;
    }

    setApprovalSubmitting(true);

    try {
      const response = await requestJson<DocumentDetailResponse>(
        `/documents/${currentDocument.id}/participants/${currentActionParticipant.id}/additional-approval`,
        {
          method: 'POST',
          body: JSON.stringify({
            userIds: approvalSelected.map((user) => user.id),
            reason,
          }),
        },
      );

      await refreshDetail(response);
      setApprovalSelected([]);
      setApprovalSearchInput('');
      setApprovalResults([]);
      setApprovalReason('');
      setAdditionalApprovalDialogOpen(false);
      showToast({
        title: t('documents.detail.additionalApprovalSuccessTitle'),
        description: t('documents.detail.additionalApprovalSuccessDescription'),
        variant: 'success',
      });
    } catch (approvalError) {
      const description = approvalError instanceof Error ? approvalError.message : null;
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        ...(description ? { description } : {}),
        variant: 'error',
      });
    } finally {
      setApprovalSubmitting(false);
    }
  }

  async function handleAddComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const comment = commentDraft.trim();

    if (!comment) {
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        description: t('documents.detail.commentEmpty'),
        variant: 'error',
      });
      return;
    }

    setCommentSubmitting(true);

    try {
      const response = await requestJson<DocumentDetailResponse>(`/documents/${currentDocument.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      });

      await refreshDetail(response);
      setCommentDraft('');
      setActiveTab('comments');
    } catch (commentError) {
      const description = commentError instanceof Error ? commentError.message : null;
      showToast({
        title: t('documents.detail.actionFailedTitle'),
        ...(description ? { description } : {}),
        variant: 'error',
      });
    } finally {
      setCommentSubmitting(false);
    }
  }

  function renderComment(comment: DocumentDetailComment) {
    const isMine = comment.actorUserId === user?.id;

    return (
      <div key={comment.id} className={['flex', isMine ? 'justify-end' : 'justify-start'].join(' ')}>
        <div className={['max-w-[82%] space-y-1.5', isMine ? 'text-right' : 'text-left'].join(' ')}>
          {!isMine ? (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{comment.actorFullName}</p>
                <p className="text-[11px] text-slate-500">{formatDateTime(comment.createdAt)}</p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">{formatDateTime(comment.createdAt)}</p>
          )}

          <div
            className={[
              'rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm',
              isMine
                ? 'rounded-br-md bg-cyan-600 text-white'
                : 'rounded-bl-md border border-slate-200 bg-slate-50 text-slate-800',
            ].join(' ')}
          >
            {comment.message}
          </div>
        </div>
      </div>
    );
  }

  function renderHistory(event: DocumentDetailHistoryItem, index: number, total: number) {
    const isLast = index === total - 1;

    return (
      <div key={event.id} className="flex gap-2.5">
        <div className="flex flex-col items-center pt-1">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-cyan-500 shadow-[0_0_0_4px_rgba(34,211,238,0.18)]" />
          {!isLast ? <span className="mt-1 w-px flex-1 bg-slate-200" /> : null}
        </div>
        <div className={['min-w-0 flex-1 rounded-xl border p-3', historyTone(event.eventType)].join(' ')}>
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <p className="text-xs font-semibold leading-5 text-slate-950">{formatHistoryDescription(event, t)}</p>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
              {formatDateTime(event.createdAt)}
            </span>
          </div>
          {event.message ? <p className="mt-1 text-[11px] leading-5 text-slate-600">{event.message}</p> : null}
          {event.reason ? (
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              <span className="font-semibold text-slate-700">{t('documents.labels.reason')}:</span> {event.reason}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.45fr)]">
        <DocumentPreview
          title={currentDocument.name}
          source={buildDocumentPreviewSource(
            currentFile
              ? {
                  mimeType: currentFile.mimeType,
                  originalFileName: currentFile.originalFileName,
                  sizeBytes: currentFile.sizeBytes,
                  previewUrl: currentFile.previewUrl,
                  downloadUrl: currentFile.downloadUrl,
                  localUrl: null,
                  localFile: previewBlob,
                  docxPreviewStatus: previewStatus,
                }
              : null,
          )}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        />

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">{t('documents.detail.summary')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                {currentDocument.typeName ?? types.find((type) => type.id === currentDocument.typeId)?.name ?? t('documents.preview.fallbackName')}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {statusLabel(currentDocument.status, t)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {t(`documents.revision.${currentDocument.revisionType}`)}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Name</p>
                <p className="mt-1 break-words text-base font-semibold leading-6 text-slate-950">{currentDocument.name}</p>
              </div>
              <p className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">Автор:</span> {currentDocument.createdByFullName}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">Створено:</span> {formatDateTime(currentDocument.createdAt)}
              </p>
            </div>
          </div>

          {currentDocument.requiresAction && currentActionParticipant ? (
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
                    {t('documents.detail.actions')}
                  </p>
                  <h2 className="mt-1 text-sm font-semibold text-slate-950">
                    {t('documents.detail.currentActionTitle', {
                      name: buildFullName(
                        currentActionParticipant.userFirstName,
                        currentActionParticipant.userLastName,
                        currentActionParticipant.userEmail,
                      ),
                    })}
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {participantTypeLabel(currentActionParticipant.participantType, t)}
                  </p>
                </div>
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-cyan-600" />
              </div>

              <div className="mt-3 space-y-2">
                <Button
                  type="button"
                  className="w-full min-w-0 overflow-hidden"
                  onClick={handleSign}
                  disabled={signing || rejecting || approvalSubmitting}
                >
                  {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span className="min-w-0 truncate">{t('documents.detail.sign')}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-w-0 overflow-hidden"
                  onClick={() => {
                    setApprovalSearchInput('');
                    setApprovalSelected([]);
                    setAdditionalApprovalDialogOpen(true);
                  }}
                  disabled={signing || rejecting || approvalSubmitting}
                >
                  <span className="min-w-0 truncate">{t('documents.detail.additionalApproval')}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-w-0 overflow-hidden border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => {
                    setRejectReason('');
                    setRejectDialogOpen(true);
                  }}
                  disabled={signing || rejecting || approvalSubmitting}
                >
                  <span className="min-w-0 truncate">{t('documents.detail.reject')}</span>
                </Button>
              </div>
            </div>
          ) : null}

          {canEditDocument || canRefund || canDelete || canResubmit ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
                {t('documents.detail.initiatorActions')}
              </p>


              {canResubmit && currentDocument.status === 'rejected' ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mt-1 text-xs font-medium text-rose-800">{t('documents.detail.rejectedReason')}</p>
                  <p className="mt-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800">
                    {currentDocument.lastRejectionReason ?? t('documents.detail.rejectedReasonEmpty')}
                  </p>
                </div>
              ) : null}

              <div className="mt-2 space-y-2">
                {canResubmit ? (
                  <Button
                    type="button"
                    className="mt-3 w-full min-w-0 overflow-hidden"
                    onClick={async () => {
                      try {
                        const response = await requestJson<DocumentDetailResponse>(`/documents/${currentDocument.id}/resubmit`, {
                          method: 'POST',
                        });

                        await refreshDetail(response);
                        showToast({
                          title: t('documents.detail.resubmitSuccessTitle'),
                          description: t('documents.detail.resubmitSuccessDescription'),
                          variant: 'success',
                        });
                      } catch (resubmitError) {
                        const description = resubmitError instanceof Error ? resubmitError.message : null;
                        showToast({
                          title: t('documents.detail.actionFailedTitle'),
                          ...(description ? { description } : {}),
                          variant: 'error',
                        });
                      }
                    }}
                  >
                    <span className="min-w-0 truncate">{t('documents.detail.resubmit')}</span>
                  </Button>
                ) : null}

                {canRefund ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-950">{t('documents.detail.refundDocument')}</p>
                    <p className="mt-1 text-xs text-slate-500">{t('documents.detail.refundDocumentHint')}</p>
                    <Button type="button" className="mt-3 w-full" onClick={handleRefundDocument} disabled={refunding || deletingDocument}>
                      {refunding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      <span className="min-w-0 truncate">{t('documents.detail.refundDocument')}</span>
                    </Button>
                  </div>
                ) : null}


                {canEditDocument ? (
                  <Button
                    type="button"
                    className="mt-2 w-full min-w-0 overflow-hidden"
                    onClick={() => setEditDialogOpen(true)}
                  >
                    <span className="min-w-0 truncate">{t('documents.detail.updateDocument')}</span>
                  </Button>
                ) : null}

                {canDelete ? (
                  <Button
                    type="button"
                    className="mt-2 w-full border-rose-200 bg-rose-600 text-white hover:bg-rose-700"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={refunding || deletingDocument}
                  >
                    {deletingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <span className="min-w-0 truncate">{t('documents.detail.deleteDocument')}</span>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">{t('documents.detail.signers')}</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">{t('documents.detail.signers')}</h2>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {signerParticipants.length}
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {signerParticipants.map((participant) => {
                const additionalApprovers = additionalApproverGroups.get(participant.id) ?? [];

                return (
                  <div key={participant.id} className="space-y-2">
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {buildFullName(participant.userFirstName, participant.userLastName, participant.userEmail)}
                        </p>
                      </div>
                      <span
                        className={[
                          'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                          participant.signedStatus === 'completed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : participant.signedStatus === 'rejected'
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700',
                        ].join(' ')}
                      >
                        {participant.signedStatus === 'completed'
                          ? t('documents.detail.statusSigned')
                          : participant.signedStatus === 'rejected'
                            ? t('documents.detail.statusRejected')
                            : t('documents.detail.statusPending')}
                      </span>
                    </div>

                    {additionalApprovers.length > 0 ? (
                      <div className="ml-6 space-y-1 border-l border-slate-200 pl-4">
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          {t('documents.detail.additionalApprovers')}
                        </div>

                        <div className="space-y-1.5">
                          {additionalApprovers.map((additionalApprover) => (
                            <div
                              key={additionalApprover.id}
                              className="relative rounded-xl border border-dashed border-slate-200 bg-white px-2.5 py-2"
                            >
                              <div className="absolute -left-[19px] top-1/2 h-px w-4 -translate-y-1/2 bg-slate-200" />
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-slate-700">
                                    {buildFullName(
                                      additionalApprover.userFirstName,
                                      additionalApprover.userLastName,
                                      additionalApprover.userEmail,
                                    )}
                                  </p>
                                  <p className="text-[11px] text-slate-500">{participantStatusLabel(additionalApprover.signedStatus, t)}</p>
                                </div>
                                <span
                                  className={[
                                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                                    additionalApprover.signedStatus === 'completed'
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : additionalApprover.signedStatus === 'rejected'
                                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                                        : 'border-amber-200 bg-amber-50 text-amber-700',
                                  ].join(' ')}
                                >
                                  {participantStatusLabel(additionalApprover.signedStatus, t)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={[
              'group relative flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium text-slate-700 transition-all duration-300 ease-out',
              activeTab === 'comments'
                ? 'bg-slate-50 text-slate-950'
                : 'hover:bg-slate-50 hover:text-slate-950',
            ].join(' ')}
          >
            <MessageSquareText className="h-4 w-4" />
            {t('documents.detail.comments')}
            <span
              className={[
                'absolute inset-x-0 bottom-0 h-0.5 origin-center rounded-full bg-cyan-300 transition-transform duration-300 ease-out',
                activeTab === 'comments' ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-60',
              ].join(' ')}
            />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={[
              'group relative flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium text-slate-700 transition-all duration-300 ease-out',
              activeTab === 'history'
                ? 'bg-slate-50 text-slate-950'
                : 'hover:bg-slate-50 hover:text-slate-950',
            ].join(' ')}
          >
            <History className="h-4 w-4" />
            {t('documents.detail.historyTab')}
            <span
              className={[
                'absolute inset-x-0 bottom-0 h-0.5 origin-center rounded-full bg-cyan-300 transition-transform duration-300 ease-out',
                activeTab === 'history' ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-60',
              ].join(' ')}
            />
          </button>
        </div>

        {activeTab === 'comments' ? (
          <div className="space-y-4 bg-white p-4">
            <div className="space-y-3">
              {currentDocument.comments.length > 0 ? (
                currentDocument.comments.map((comment) => renderComment(comment))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  {t('documents.detail.commentEmpty')}
                </div>
              )}
            </div>

            <form className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm" onSubmit={handleAddComment}>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">{t('documents.detail.addComment')}</span>
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  rows={4}
                  placeholder={t('documents.detail.commentPlaceholder')}
                  className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <div className="mt-3 flex justify-end">
                <Button type="submit" disabled={commentSubmitting} className="min-w-32">
                  {commentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t('documents.detail.addComment')}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-3 bg-white p-4">
            {history.map((event, index) => renderHistory(event, index, history.length))}
          </div>
        )}
      </div>

      {deleteDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
                  {t('documents.detail.deleteDocument')}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{t('documents.detail.deleteDocumentConfirm')}</h3>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-5 px-5 py-4">
              <p className="text-sm leading-6 text-slate-600">{t('documents.detail.deleteDocumentConfirmMessage')}</p>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={deletingDocument}
                >
                  {t('actions.cancel')}
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-rose-600 text-white hover:bg-rose-700"
                  onClick={handleDeleteDocument}
                  disabled={deletingDocument}
                >
                  {deletingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('documents.detail.deleteDocument')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
                  {t('documents.detail.updateDocument')}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{t('documents.detail.updateDocumentTitle')}</h3>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setEditDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-5 px-5 py-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">{t('documents.detail.editNameLabel')}</span>
                <Input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  placeholder={t('documents.placeholders.name')}
                />
              </label>

              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">{t('documents.detail.editFileLabel')}</span>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center transition-colors hover:border-cyan-300 hover:bg-cyan-50/40">
                  <Upload className="h-6 w-6 text-slate-400" />
                  <span className="mt-2 text-sm font-medium text-slate-900">{t('documents.detail.replaceFileAction')}</span>
                  <span className="mt-1 text-xs leading-5 text-slate-500">{t('documents.upload.subtitle')}</span>
                  <input
                    ref={replacementFileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.webp,.svg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                    onChange={(event) => setReplacementFile(event.target.files?.[0] ?? null)}
                  />
                </label>

                {replacementFile ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{replacementFile.name}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(new Date().toISOString())}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setReplacementFile(null);
                          if (replacementFileInputRef.current) {
                            replacementFileInputRef.current.value = '';
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <div className="min-w-0 overflow-hidden rounded-xl bg-white px-3 py-2">
                        <span className="block font-medium text-slate-500">{t('documents.filePreview.size')}</span>
                        <span className="block min-w-0 text-slate-900">
                          {replacementFile ? `${(replacementFile.size / (1024 * 1024)).toFixed(2)} MB` : '—'}
                        </span>
                      </div>
                      <div className="min-w-0 overflow-hidden rounded-xl bg-white px-3 py-2">
                        <span className="block font-medium text-slate-500">{t('documents.filePreview.type')}</span>
                        <span className="block min-w-0 truncate text-slate-900">{replacementFile.type || '—'}</span>
                      </div>
                    </div>

                    {replacementPreview && replacementFile.type.startsWith('image/') ? (
                      <img
                        src={replacementPreview}
                        alt={replacementFile.name}
                        className="mt-3 max-h-60 w-full rounded-xl object-contain bg-white"
                      />
                    ) : null}

                    {replacementFileError ? (
                      <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {replacementFileError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  {t('actions.close')}
                </Button>
                <Button type="button" className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={handleUpdateDocument} disabled={updatingDocument}>
                  {updatingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span className="min-w-0 truncate">{t('documents.detail.updateDocument')}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rejectDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
                  {t('documents.detail.rejectDialogTitle')}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{t('documents.detail.reject')}</h3>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setRejectDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form
              className="mt-4 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!currentActionParticipant) {
                  return;
                }

                const reason = rejectReason.trim();
                if (reason.length < 3) {
                  showToast({
                    title: t('documents.detail.actionFailedTitle'),
                    description: t('documents.detail.rejectReasonRequired'),
                    variant: 'error',
                  });
                  return;
                }

                setRejecting(true);

                try {
                  const response = await requestJson<DocumentDetailResponse>(
                    `/documents/${currentDocument.id}/participants/${currentActionParticipant.id}/reject`,
                    {
                      method: 'POST',
                      body: JSON.stringify({ reason }),
                    },
                  );

                  await refreshDetail(response);
                  setRejectReason('');
                  setRejectDialogOpen(false);
                  showToast({
                    title: t('documents.detail.rejectSuccessTitle'),
                    description: t('documents.detail.rejectSuccessDescription'),
                    variant: 'success',
                  });
                } catch (rejectError) {
                  const description = rejectError instanceof Error ? rejectError.message : null;
                  showToast({
                    title: t('documents.detail.actionFailedTitle'),
                    ...(description ? { description } : {}),
                    variant: 'error',
                  });
                } finally {
                  setRejecting(false);
                }
              }}
            >
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">{t('documents.detail.rejectReasonLabel')}</span>
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={4}
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  placeholder={t('documents.detail.rejectReasonPlaceholder')}
                />
              </label>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setRejectDialogOpen(false)}>
                  {t('actions.cancel')}
                </Button>
                <Button type="submit" className="flex-1 border-rose-200 bg-rose-600 text-white hover:bg-rose-700" disabled={rejecting}>
                  {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('documents.detail.reject')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {additionalApprovalDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
                  {t('documents.detail.additionalApprovalTitle')}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{t('documents.detail.additionalApproval')}</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setAdditionalApprovalDialogOpen(false);
                  setApprovalReason('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleAdditionalApproval}>
              <div className="space-y-1">
                <p className="text-sm text-slate-600">{t('documents.detail.additionalApprovalDescription')}</p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">{t('documents.detail.additionalApprovalReasonLabel')}</span>
                <textarea
                  value={approvalReason}
                  onChange={(event) => setApprovalReason(event.target.value)}
                  rows={3}
                  placeholder={t('documents.detail.additionalApprovalReasonPlaceholder')}
                  className="min-h-20 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              {approvalSelected.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {approvalSelected.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => removeApprover(user.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {user.fullName}
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={approvalSearchInput}
                  onChange={(event) => setApprovalSearchInput(event.target.value)}
                  placeholder={t('documents.participantSearch')}
                  className="pl-10"
                />
              </label>

              {approvalLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  {t('documents.searchLoading')}
                </div>
              ) : approvalResults.length > 0 ? (
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  {approvalResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => addApprover(user)}
                      className="flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block min-w-0 truncate text-sm font-medium text-slate-900">{user.fullName}</span>
                        <span className="block min-w-0 truncate text-xs text-slate-500">{user.email}</span>
                      </span>
                      <span className="shrink-0 text-xs text-cyan-700">{t('actions.add')}</span>
                    </button>
                  ))}
                </div>
              ) : approvalSearchInput.trim().length >= 2 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                  {t('documents.searchEmpty')}
                </div>
              ) : null}

              <div className="flex flex-col md:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setAdditionalApprovalDialogOpen(false);
                    setApprovalReason('');
                  }}
                >
                  {t('actions.cancel')}
                </Button>
                <Button type="submit" className="flex-1" disabled={approvalSubmitting}>
                  {approvalSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('documents.detail.additionalApprovalSubmit')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
