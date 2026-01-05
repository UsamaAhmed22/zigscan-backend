import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedItem } from '../database/entities/saved-item.entity';
import { CreateSavedItemDto } from './dto/create-saved-item.dto';
import { GetSavedItemsQueryDto } from './dto/get-saved-items-query.dto';

@Injectable()
export class SavedItemsService {
  private readonly logger = new Logger(SavedItemsService.name);

  constructor(
    @InjectRepository(SavedItem)
    private readonly savedItemRepository: Repository<SavedItem>,
  ) {}

  /**
   * Save a new item for a user
   */
  async createSavedItem(
    userId: string,
    createSavedItemDto: CreateSavedItemDto,
  ): Promise<SavedItem> {
    const { itemSaved, itemType } = createSavedItemDto;

    // Check if item already saved by this user
    const existingItem = await this.savedItemRepository.findOne({
      where: {
        userId,
        itemSaved,
      },
    });

    if (existingItem) {
      throw new ConflictException('Item already saved');
    }

    const savedItem = this.savedItemRepository.create({
      userId,
      itemSaved,
      itemType,
    });

    const result = await this.savedItemRepository.save(savedItem);
    this.logger.log(`User ${userId} saved item: ${itemSaved}`);

    return result;
  }

  /**
   * Get all saved items for a user with optional filtering
   */
  async getSavedItems(
    userId: string,
    query: GetSavedItemsQueryDto,
  ): Promise<{
    items: SavedItem[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const { itemType, limit = 20, offset = 0 } = query;

    const queryBuilder = this.savedItemRepository
      .createQueryBuilder('saved_item')
      .where('saved_item.user_id = :userId', { userId });

    // Filter by item type if provided
    if (itemType) {
      queryBuilder.andWhere('saved_item.item_type = :itemType', { itemType });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination and ordering
    const items = await queryBuilder
      .orderBy('saved_item.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get a specific saved item by ID
   */
  async getSavedItemById(userId: string, itemId: string): Promise<SavedItem> {
    const savedItem = await this.savedItemRepository.findOne({
      where: {
        id: itemId,
        userId,
      },
    });

    if (!savedItem) {
      throw new NotFoundException('Saved item not found');
    }

    return savedItem;
  }

  /**
   * Check if an item is saved by a user
   */
  async isItemSaved(userId: string, itemSaved: string): Promise<boolean> {
    const count = await this.savedItemRepository.count({
      where: {
        userId,
        itemSaved,
      },
    });

    return count > 0;
  }

  /**
   * Delete a saved item
   */
  async deleteSavedItem(userId: string, itemId: string): Promise<{ message: string }> {
    const savedItem = await this.getSavedItemById(userId, itemId);

    await this.savedItemRepository.remove(savedItem);
    this.logger.log(`User ${userId} deleted saved item: ${itemId}`);

    return { message: 'Saved item deleted successfully' };
  }

  /**
   * Delete all saved items for a user
   */
  async deleteAllSavedItems(userId: string): Promise<{ message: string; deletedCount: number }> {
    const result = await this.savedItemRepository.delete({ userId });

    this.logger.log(`User ${userId} deleted all saved items (${result.affected || 0} items)`);

    return {
      message: 'All saved items deleted successfully',
      deletedCount: result.affected || 0,
    };
  }

  /**
   * Get saved items count for a user
   */
  async getSavedItemsCount(
    userId: string,
  ): Promise<{ total: number; byType: Record<string, number> }> {
    const total = await this.savedItemRepository.count({ where: { userId } });

    // Get count by type
    const byTypeResults = await this.savedItemRepository
      .createQueryBuilder('saved_item')
      .select('saved_item.item_type', 'itemType')
      .addSelect('COUNT(*)', 'count')
      .where('saved_item.user_id = :userId', { userId })
      .groupBy('saved_item.item_type')
      .getRawMany();

    const byType: Record<string, number> = {};
    byTypeResults.forEach(result => {
      const type = result.itemType || 'uncategorized';
      byType[type] = parseInt(result.count, 10);
    });

    return { total, byType };
  }
}
