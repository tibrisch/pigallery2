import {Injectable} from '@angular/core';
import {NetworkService} from '../../../model/network/network.service';
import {IAutoCompleteItem} from '../../../../../common/entities/AutoCompleteItem';
import {GalleryCacheService} from '../cache.gallery.service';
import {SearchQueryParserService} from './search-query-parser.service';
import {BehaviorSubject} from 'rxjs';
import {SearchQueryTypes, TextSearchQueryTypes} from '../../../../../common/entities/SearchQueryDTO';
import {QueryParams} from '../../../../../common/QueryParams';
import {SearchQueryParser} from '../../../../../common/SearchQueryParser';

@Injectable()
export class AutoCompleteService {

  private keywords: string[] = [];
  private relationKeywords: string[] = [];
  private textSearchKeywordsMap: { [key: string]: SearchQueryTypes } = {};

  constructor(private _networkService: NetworkService,
              private _searchQueryParserService: SearchQueryParserService,
              private _galleryCacheService: GalleryCacheService) {
    this.keywords = Object.values(this._searchQueryParserService.keywords)
      .filter(k => k !== this._searchQueryParserService.keywords.or &&
        k !== this._searchQueryParserService.keywords.and &&
        k !== this._searchQueryParserService.keywords.portrait &&
        k !== this._searchQueryParserService.keywords.kmFrom &&
        k !== this._searchQueryParserService.keywords.NSomeOf)
      .map(k => k + ':');

    this.keywords.push(this._searchQueryParserService.keywords.and);
    this.keywords.push(this._searchQueryParserService.keywords.or);
    for (let i = 0; i < 10; i++) {
      this.keywords.push(i + this._searchQueryParserService.keywords.NSomeOf);
    }

    this.keywords.push(this._searchQueryParserService.keywords.to + ':' +
      SearchQueryParser.stringifyText((new Date).getFullYear().toString()));
    this.keywords.push(this._searchQueryParserService.keywords.to + ':' +
      SearchQueryParser.stringifyText((new Date).toLocaleDateString()));
    this.keywords.push(this._searchQueryParserService.keywords.from + ':' +
      SearchQueryParser.stringifyText((new Date).getFullYear().toString()));
    this.keywords.push(this._searchQueryParserService.keywords.from + ':' +
      SearchQueryParser.stringifyText((new Date).toLocaleDateString()));

    TextSearchQueryTypes.forEach(t => {
      this.textSearchKeywordsMap[(<any>this._searchQueryParserService.keywords)[SearchQueryTypes[t]]] = t;
    });
  }

  public autoComplete(text: { current: string, prev: string }): BehaviorSubject<RenderableAutoCompleteItem[]> {
    const items: BehaviorSubject<RenderableAutoCompleteItem[]> = new BehaviorSubject(
      this.sortResults(text.current, this.getQueryKeywords(text)));

    const type = this.getTypeFromPrefix(text.current);
    const searchText = this.getPrefixLessSearchText(text.current);
    if (searchText === '') {
      return items;
    }
    this.typedAutoComplete(searchText, type, items);
    return items;
  }

  public typedAutoComplete(text: string, type: SearchQueryTypes,
                           items?: BehaviorSubject<RenderableAutoCompleteItem[]>): BehaviorSubject<RenderableAutoCompleteItem[]> {
    items = items || new BehaviorSubject([]);

    const cached = this._galleryCacheService.getAutoComplete(text, type);
    if (cached == null) {
      const acParams: any = {};
      if (type) {
        acParams[QueryParams.gallery.search.type] = type;
      }
      this._networkService.getJson<IAutoCompleteItem[]>('/autocomplete/' + text, acParams).then(ret => {
        this._galleryCacheService.setAutoComplete(text, type, ret);
        items.next(this.sortResults(text, ret.map(i => this.ACItemToRenderable(i)).concat(items.value)));
      });
    } else {
      items.next(this.sortResults(text, cached.map(i => this.ACItemToRenderable(i)).concat(items.value)));
    }
    return items;
  }

  public getPrefixLessSearchText(text: string): string {
    const tokens = text.split(':');
    if (tokens.length !== 2) {
      return text;
    }
    // make sure autocomplete works for 'keyword:"' searches
    if (tokens[1].charAt(0) === '"' || tokens[1].charAt(0) === '(') {
      return tokens[1].substring(1);
    }
    return tokens[1];
  }

  private getTypeFromPrefix(text: string): SearchQueryTypes {
    const tokens = text.split(':');
    if (tokens.length !== 2) {
      return null;
    }
    return this.textSearchKeywordsMap[tokens[0]] || null;
  }

  private ACItemToRenderable(item: IAutoCompleteItem): RenderableAutoCompleteItem {
    if (!item.type) {
      return {text: item.text, queryHint: item.text};
    }
    if (TextSearchQueryTypes.includes(item.type) && item.type !== SearchQueryTypes.any_text) {
      return {
        text: item.text, type: item.type,
        queryHint:
          (<any>this._searchQueryParserService.keywords)[SearchQueryTypes[item.type]] + ':"' + item.text + '"'
      };
    }
    return {
      text: item.text, type: item.type, queryHint: item.text
    };
  }

  private sortResults(text: string, items: RenderableAutoCompleteItem[]) {
    return items.sort((a, b) => {
      if ((a.text.startsWith(text) && b.text.startsWith(text)) ||
        (!a.text.startsWith(text) && !b.text.startsWith(text))) {
        return a.text.localeCompare(b.text);
      } else if (a.text.startsWith(text)) {
        return -1;
      }
      return 1;
    });

  }

  private getQueryKeywords(text: { current: string, prev: string }): RenderableAutoCompleteItem[] {
    // if empty, recommend "and"
    if (text.current === '') {
      if (text.prev !== this._searchQueryParserService.keywords.and) {
        return [{
          text: this._searchQueryParserService.keywords.and,
          queryHint: this._searchQueryParserService.keywords.and,
          notSearchable: true
        }];
      } else {
        return [];
      }
    }
    return this.keywords
      .filter(key => key.startsWith(text.current))
      .map(key => ({
        text: key,
        queryHint: key,
        notSearchable: true
      }));
  }
}

export interface RenderableAutoCompleteItem extends IAutoCompleteItem {
  queryHint: string;
  notSearchable?: boolean; // prevent triggering search if it is not a full search term
}
