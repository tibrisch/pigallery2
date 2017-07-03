import {Injectable} from "@angular/core";
import {NetworkService} from "../model/network/network.service";
import {ContentWrapper} from "../../../common/entities/ConentWrapper";
import {PhotoDTO} from "../../../common/entities/PhotoDTO";
import {DirectoryDTO} from "../../../common/entities/DirectoryDTO";
import {SearchTypes} from "../../../common/entities/AutoCompleteItem";
import {GalleryCacheService} from "./cache.gallery.service";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {SharingDTO} from "../../../common/entities/SharingDTO";
import {Config} from "../../../common/config/public/Config";
import {ShareService} from "./share.service";

@Injectable()
export class GalleryService {

  public content: BehaviorSubject<ContentWrapper>;
  private lastDirectory: DirectoryDTO;
  private searchId: any;

  constructor(private networkService: NetworkService,
              private galleryCacheService: GalleryCacheService,
              private _shareService: ShareService) {
    this.content = new BehaviorSubject<ContentWrapper>(new ContentWrapper());
  }

  lastRequest: { directory: string } = {
    directory: null
  };

  public async getDirectory(directoryName: string): Promise<ContentWrapper> {
    const content = new ContentWrapper();

    content.directory = this.galleryCacheService.getDirectory(directoryName);
    content.searchResult = null;

    this.content.next(content);
    this.lastRequest.directory = directoryName;

    let cw: ContentWrapper = null;
    if (Config.Client.Sharing.enabled == true) {
      if (this._shareService.isSharing()) {
        cw = await this.networkService.getJson<ContentWrapper>("/gallery/content/" + directoryName + "?sk=" + this._shareService.getSharingKey());
      }
    }
    if (cw == null) {
      cw = await this.networkService.getJson<ContentWrapper>("/gallery/content/" + directoryName);
    }

    this.galleryCacheService.setDirectory(cw.directory); //save it before adding references

    if (this.lastRequest.directory != directoryName) {
      return;
    }

    //Add references
    let addDir = (dir: DirectoryDTO) => {
      dir.photos.forEach((photo: PhotoDTO) => {
        photo.directory = dir;
      });

      dir.directories.forEach((directory: DirectoryDTO) => {
        addDir(directory);
        directory.parent = dir;
      });


    };
    addDir(cw.directory);


    this.lastDirectory = cw.directory;
    this.content.next(cw);


    return cw;

  }

  //TODO: cache
  public async search(text: string, type?: SearchTypes): Promise<ContentWrapper> {
    clearTimeout(this.searchId);
    if (text === null || text === '') {
      return null
    }

    let queryString = "/search/" + text;
    if (type) {
      queryString += "?type=" + type;
    }
    const cw: ContentWrapper = await this.networkService.getJson<ContentWrapper>(queryString);
    this.content.next(cw);
    return cw;
  }

  //TODO: cache (together with normal search)
  public async instantSearch(text: string): Promise<ContentWrapper> {
    if (text === null || text === '') {
      const content = new ContentWrapper();
      content.directory = this.lastDirectory;
      content.searchResult = null;
      this.content.next(content);
      clearTimeout(this.searchId);
      return null
    }

    if (this.searchId != null) {
      clearTimeout(this.searchId);

    }
    this.searchId = setTimeout(() => {
      this.search(text);
      this.searchId = null;
    }, 3000); //TODO: set timeout to config

    const cw = await this.networkService.getJson<ContentWrapper>("/instant-search/" + text);
    this.content.next(cw);
    return cw;

  }

  public async getSharing(sharingKey: string): Promise<SharingDTO> {
    return this.networkService.getJson<SharingDTO>("/share/" + sharingKey);
  }

}
