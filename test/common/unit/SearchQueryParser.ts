import {expect} from 'chai';
import {
  ANDSearchQuery,
  DistanceSearch,
  FromDateSearch,
  MaxRatingSearch,
  MaxResolutionSearch,
  MinRatingSearch,
  MinResolutionSearch,
  OrientationSearch,
  ORSearchQuery,
  RangeSearch,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes,
  ToDateSearch
} from '../../../src/common/entities/SearchQueryDTO';
import {QueryKeywords, SearchQueryParser} from '../../../src/common/SearchQueryParser';

describe('SearchQueryParser', () => {

  const keywords: QueryKeywords = {
    NSomeOf: '-of',
    and: 'and',
    caption: 'caption',
    directory: 'directory',
    file_name: 'file-name',
    from: 'from',
    keyword: 'keyword',
    landscape: 'landscape',
    maxRating: 'max-rating',
    maxResolution: 'max-resolution',
    minRating: 'min-rating',
    minResolution: 'min-resolution',
    or: 'or',
    orientation: 'orientation',
    person: 'person',
    portrait: 'portrait',
    position: 'position',
    someOf: 'some-of',
    to: 'to',
    kmFrom: 'km-from'
  };

  const check = (query: SearchQueryDTO) => {
    const parser = new SearchQueryParser(keywords);
    expect(parser.parse(parser.stringify(query))).to.deep.equals(query, parser.stringify(query));

  };

  describe('should serialize and deserialize', () => {
    it('Text search', () => {
      check(<TextSearch>{type: SearchQueryTypes.any_text, text: 'test'});
      check(<TextSearch>{type: SearchQueryTypes.person, text: 'person_test'});
      check(<TextSearch>{type: SearchQueryTypes.directory, text: 'directory'});
      check(<TextSearch>{type: SearchQueryTypes.keyword, text: 'big boom'});
      check(<TextSearch>{type: SearchQueryTypes.caption, text: 'caption'});
      check(<TextSearch>{type: SearchQueryTypes.file_name, text: 'filename'});
      check(<TextSearch>{type: SearchQueryTypes.position, text: 'New York'});
      check(<TextSearch>{
        type: SearchQueryTypes.position,
        matchType: TextSearchQueryMatchTypes.exact_match,
        text: 'New York'
      });
    });

    it('Date search', () => {
      check(<FromDateSearch>{type: SearchQueryTypes.from_date, value: (new Date(2020, 1, 10)).getTime()});
      check(<FromDateSearch>{type: SearchQueryTypes.from_date, value: (new Date(2020, 1, 1)).getTime()});
      check(<ToDateSearch>{type: SearchQueryTypes.to_date, value: (new Date(2020, 1, 20)).getTime()});
      check(<ToDateSearch>{type: SearchQueryTypes.to_date, value: (new Date(2020, 1, 1)).getTime()});

      const parser = new SearchQueryParser(keywords);
      // test if date gets simplified on 1st of Jan.
      let query: RangeSearch = <ToDateSearch>{type: SearchQueryTypes.to_date, value: (new Date(2020, 0, 1)).getTime()};
      expect(parser.parse(keywords.to + ':' + (new Date(query.value)).getFullYear()))
        .to.deep.equals(query, parser.stringify(query));

      query = <FromDateSearch>{type: SearchQueryTypes.from_date, value: (new Date(2020, 0, 1)).getTime()};
      expect(parser.parse(keywords.from + ':' + (new Date(query.value)).getFullYear()))
        .to.deep.equals(query, parser.stringify(query));

    });
    it('Rating search', () => {
      check(<MinRatingSearch>{type: SearchQueryTypes.min_rating, value: 10});
      check(<MaxRatingSearch>{type: SearchQueryTypes.max_rating, value: 1});
    });
    it('Resolution search', () => {
      check(<MinResolutionSearch>{type: SearchQueryTypes.min_resolution, value: 10});
      check(<MaxResolutionSearch>{type: SearchQueryTypes.max_resolution, value: 5});
    });
    it('Distance search', () => {
      check(<DistanceSearch>{type: SearchQueryTypes.distance, distance: 10, from: {text: 'New York'}});
    });
    it('OrientationSearch search', () => {
      check(<OrientationSearch>{type: SearchQueryTypes.orientation, landscape: true});
      check(<OrientationSearch>{type: SearchQueryTypes.orientation, landscape: false});
    });
    it('And search', () => {
      check(<ANDSearchQuery>{
        type: SearchQueryTypes.AND,
        list: [
          <TextSearch>{type: SearchQueryTypes.keyword, text: 'big boom'},
          <TextSearch>{type: SearchQueryTypes.position, text: 'New York'}
        ]
      });

      check(<ANDSearchQuery>{
        type: SearchQueryTypes.AND,
        list: [
          <TextSearch>{type: SearchQueryTypes.keyword, text: 'big boom'},
          <TextSearch>{
            type: SearchQueryTypes.position,
            matchType: TextSearchQueryMatchTypes.exact_match,
            text: 'New York'
          }
        ]
      });
      check(<ANDSearchQuery>{
        type: SearchQueryTypes.AND,
        list: [
          <TextSearch>{type: SearchQueryTypes.keyword, text: 'big boom'},
          <ANDSearchQuery>{
            type: SearchQueryTypes.AND,
            list: [
              <TextSearch>{type: SearchQueryTypes.caption, text: 'caption'},
              <TextSearch>{type: SearchQueryTypes.position, text: 'New York'}
            ]
          }
        ]
      });
      check(<ANDSearchQuery>{
        type: SearchQueryTypes.AND,
        list: [
          <SomeOfSearchQuery>{
            type: SearchQueryTypes.SOME_OF,
            min: 2,
            list: [
              <TextSearch>{type: SearchQueryTypes.keyword, text: 'big boom'},
              <TextSearch>{type: SearchQueryTypes.position, text: 'New York'},
              <TextSearch>{type: SearchQueryTypes.caption, text: 'caption test'}
            ]
          },
          <TextSearch>{type: SearchQueryTypes.position, text: 'New York'}
        ]
      });
    });
    it('Or search', () => {
      check(<ORSearchQuery>{
        type: SearchQueryTypes.OR,
        list: [
          <TextSearch>{type: SearchQueryTypes.keyword, text: 'big boom'},
          <TextSearch>{type: SearchQueryTypes.position, text: 'New York'}
        ]
      });
      check(<ORSearchQuery>{
        type: SearchQueryTypes.OR,
        list: [
          <ORSearchQuery>{
            type: SearchQueryTypes.OR,
            list: [
              <TextSearch>{type: SearchQueryTypes.keyword, text: 'big boom'},
              <TextSearch>{type: SearchQueryTypes.person, text: 'person_test'}
            ]
          },
          <TextSearch>{type: SearchQueryTypes.position, text: 'New York'}
        ]
      });
    });
    it('Some of search', () => {
      check(<SomeOfSearchQuery>{
        type: SearchQueryTypes.SOME_OF,
        list: [
          <TextSearch>{type: SearchQueryTypes.keyword, text: 'big boom'},
          <TextSearch>{type: SearchQueryTypes.position, text: 'New York'}
        ]
      });
      check(<SomeOfSearchQuery>{
        type: SearchQueryTypes.SOME_OF,
        list: [
          <TextSearch>{
            type: SearchQueryTypes.keyword,
            matchType: TextSearchQueryMatchTypes.exact_match,
            text: 'big boom'
          },
          <TextSearch>{
            type: SearchQueryTypes.position,
            matchType: TextSearchQueryMatchTypes.exact_match,
            text: 'New York'
          },
        ]
      });
      check(<SomeOfSearchQuery>{
        type: SearchQueryTypes.SOME_OF,
        min: 2,
        list: [
          <TextSearch>{type: SearchQueryTypes.keyword, text: 'big boom'},
          <TextSearch>{type: SearchQueryTypes.position, text: 'New York'},
          <TextSearch>{type: SearchQueryTypes.caption, text: 'caption test'}
        ]
      });
      check(<SomeOfSearchQuery>{
        type: SearchQueryTypes.SOME_OF,
        min: 2,
        list: [
          <TextSearch>{type: SearchQueryTypes.keyword, text: 'big boom'},
          <TextSearch>{type: SearchQueryTypes.person, text: 'person_test'},
          <ANDSearchQuery>{
            type: SearchQueryTypes.AND,
            list: [
              <TextSearch>{type: SearchQueryTypes.caption, text: 'caption'},
              <TextSearch>{type: SearchQueryTypes.position, text: 'New York'}
            ]
          }
        ]
      });
    });
  });


});
