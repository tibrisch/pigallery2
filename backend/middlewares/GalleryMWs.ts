import * as path from "path";
import * as fs from "fs";
import {NextFunction, Request, Response} from "express";
import {Error, ErrorCodes} from "../../common/entities/Error";
import {DirectoryDTO} from "../../common/entities/DirectoryDTO";
import {ObjectManagerRepository} from "../model/ObjectManagerRepository";
import {AutoCompleteItem, SearchTypes} from "../../common/entities/AutoCompleteItem";
import {ContentWrapper} from "../../common/entities/ConentWrapper";
import {SearchResultDTO} from "../../common/entities/SearchResult";
import {PhotoDTO} from "../../common/entities/PhotoDTO";
import {ProjectPath} from "../ProjectPath";
import {Logger} from "../Logger";
import {Config} from "../../common/config/private/Config";
import {UserUtil} from "../../common/entities/UserDTO";


const LOG_TAG = "[GalleryMWs]";
export class GalleryMWs {


  public static async listDirectory(req: Request, res: Response, next: NextFunction) {
    let directoryName = req.params.directory || "/";
    let absoluteDirectoryName = path.join(ProjectPath.ImageFolder, directoryName);

    if (!fs.statSync(absoluteDirectoryName).isDirectory()) {
      return next();
    }

    try {

      const directory = await ObjectManagerRepository.getInstance().GalleryManager.listDirectory(directoryName);
      if (req.session.user.permissions &&
        req.session.user.permissions.length > 0 &&
        req.session.user.permissions[0] != "/") {
        directory.directories = directory.directories.filter(d =>
          UserUtil.isDirectoryAvailable(d, req.session.user.permissions));
      }
      req.resultPipe = new ContentWrapper(directory, null);
      return next();

    } catch (err) {
      Logger.warn(LOG_TAG, "Error during listing the directory", err);
      console.error(err);
      return next(new Error(ErrorCodes.GENERAL_ERROR, err));
    }
  }


  public static removeCyclicDirectoryReferences(req: Request, res: Response, next: NextFunction) {
    if (!req.resultPipe)
      return next();

    let cw: ContentWrapper = req.resultPipe;
    let removeDirs = (dir) => {
      dir.photos.forEach((photo: PhotoDTO) => {
        photo.directory = null;
      });

      dir.directories.forEach((directory: DirectoryDTO) => {
        removeDirs(directory);
        directory.parent = null;
      });

    };

    if (cw.directory) {
      removeDirs(cw.directory);
    }


    return next();
  }


  public static loadImage(req: Request, res: Response, next: NextFunction) {
    if (!(req.params.imagePath)) {
      return next();
    }

    let fullImagePath = path.join(ProjectPath.ImageFolder, req.params.imagePath);
    if (fs.statSync(fullImagePath).isDirectory()) {
      return next();
    }

    //check if thumbnail already exist
    if (fs.existsSync(fullImagePath) === false) {
      return next(new Error(ErrorCodes.GENERAL_ERROR, "no such file :" + fullImagePath));
    }

    req.resultPipe = fullImagePath;
    return next();
  }


  public static search(req: Request, res: Response, next: NextFunction) {
    if (Config.Client.Search.searchEnabled === false) {
      return next();
    }

    if (!(req.params.text)) {
      return next();
    }

    let type: SearchTypes;
    if (req.query.type) {
      type = parseInt(req.query.type);
    }

    ObjectManagerRepository.getInstance().SearchManager.search(req.params.text, type, (err, result: SearchResultDTO) => {
      if (err || !result) {
        return next(new Error(ErrorCodes.GENERAL_ERROR, err));
      }
      req.resultPipe = new ContentWrapper(null, result);
      return next();
    });
  }


  public static instantSearch(req: Request, res: Response, next: NextFunction) {
    if (Config.Client.Search.instantSearchEnabled === false) {
      return next();
    }

    if (!(req.params.text)) {
      return next();
    }


    ObjectManagerRepository.getInstance().SearchManager.instantSearch(req.params.text, (err, result: SearchResultDTO) => {
      if (err || !result) {
        return next(new Error(ErrorCodes.GENERAL_ERROR, err));
      }
      req.resultPipe = new ContentWrapper(null, result);
      return next();
    });
  }

  public static autocomplete(req: Request, res: Response, next: NextFunction) {
    if (Config.Client.Search.autocompleteEnabled === false) {
      return next();
    }
    if (!(req.params.text)) {
      return next();
    }

    ObjectManagerRepository.getInstance().SearchManager.autocomplete(req.params.text, (err, items: Array<AutoCompleteItem>) => {
      if (err || !items) {
        return next(new Error(ErrorCodes.GENERAL_ERROR, err));
      }
      req.resultPipe = items;
      return next();
    });
  }


}
