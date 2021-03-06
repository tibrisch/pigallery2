import {Utils} from '../../../../common/Utils';
import {MediaIcon} from './MediaIcon';
import {Config} from '../../../../common/config/public/Config';
import {MediaBaseDTO, MediaDTO} from '../../../../common/entities/MediaDTO';

export class Media extends MediaIcon {

  static readonly sortedThumbnailSizes = Config.Client.Media.Thumbnail.thumbnailSizes
    .sort((a, b) => a - b);

  constructor(media: MediaBaseDTO, public renderWidth: number, public renderHeight: number) {
    super(media);
  }


  thumbnailLoaded() {
    if (!this.isThumbnailAvailable()) {
      this.media.readyThumbnails = this.media.readyThumbnails || [];
      this.media.readyThumbnails.push(this.getThumbnailSize());
    }
  }

  getThumbnailSize() {
    const longerEdge = Math.max(this.renderWidth, this.renderHeight);
    return Utils.findClosestinSorted(longerEdge, Media.sortedThumbnailSizes);
  }

  getReplacementThumbnailSize(): number {

    if (this.replacementSizeCache === false) {
      this.replacementSizeCache = null;

      const size = this.getThumbnailSize();
      if (!!this.media.readyThumbnails) {
        for (let i = 0; i < this.media.readyThumbnails.length; i++) {
          if (this.media.readyThumbnails[i] < size) {
            this.replacementSizeCache = this.media.readyThumbnails[i];
            break;
          }
        }
      }
    }
    return <number>this.replacementSizeCache;
  }

  isReplacementThumbnailAvailable() {
    return this.getReplacementThumbnailSize() !== null;
  }

  isThumbnailAvailable() {
    return this.media.readyThumbnails && this.media.readyThumbnails.indexOf(this.getThumbnailSize()) !== -1;
  }

  getReplacementThumbnailPath() {
    const size = this.getReplacementThumbnailSize();
    return Utils.concatUrls(Config.Client.urlBase,
      '/api/gallery/content/',
      this.media.directory.path, this.media.directory.name, this.media.name, 'thumbnail', size.toString());

  }

  hasPositionData(): boolean {
    return MediaDTO.hasPositionData(this.media);
  }

  getThumbnailPath() {
    const size = this.getThumbnailSize();
    return Utils.concatUrls(Config.Client.urlBase,
      '/api/gallery/content/',
      this.media.directory.path, this.media.directory.name, this.media.name, 'thumbnail', size.toString());
  }


}
