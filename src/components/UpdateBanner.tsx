import "./UpdateBanner.css";

interface UpdateInfo {
  version: string;
  body?: string;
}

interface UpdateBannerProps {
  updateInfo: UpdateInfo;
  downloading: boolean;
  progress: number;
  error: string | null;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({
  updateInfo,
  downloading,
  progress,
  error,
  onInstall,
  onDismiss,
}: UpdateBannerProps) {
  return (
    <div className="update-banner">
      <div className="update-banner-content">
        <div className="update-banner-icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" role="img" aria-label="Update available">
            <title>Update available</title>
            <path
              d="M10 2L10 14M10 14L6 10M10 14L14 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 17H17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        
        <div className="update-banner-text">
          {downloading ? (
            <>
              <span className="update-banner-title">Downloading update...</span>
              <div className="update-banner-progress">
                <div 
                  className="update-banner-progress-bar" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : error ? (
            <>
              <span className="update-banner-title">Update failed</span>
              <span className="update-banner-subtitle">{error}</span>
            </>
          ) : (
            <>
              <span className="update-banner-title">
                Version {updateInfo.version} available
              </span>
              {updateInfo.body && (
                <span className="update-banner-subtitle">
                  {updateInfo.body.slice(0, 100)}
                  {updateInfo.body.length > 100 ? "..." : ""}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="update-banner-actions">
        {!downloading && (
          <>
            <button 
              type="button"
              className="update-banner-btn update-banner-btn-dismiss"
              onClick={onDismiss}
            >
              Later
            </button>
            <button 
              type="button"
              className="update-banner-btn update-banner-btn-install"
              onClick={onInstall}
            >
              {error ? "Retry" : "Update"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
