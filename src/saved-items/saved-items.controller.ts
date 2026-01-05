import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SavedItemsService } from './saved-items.service';
import { CreateSavedItemDto } from './dto/create-saved-item.dto';
import { GetSavedItemsQueryDto } from './dto/get-saved-items-query.dto';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';

@ApiTags('Saved Items')
@Controller('api/v2/saved-items')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class SavedItemsController {
  constructor(private readonly savedItemsService: SavedItemsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save a new item for the authenticated user' })
  @ApiResponse({ status: 201, description: 'Item saved successfully' })
  @ApiResponse({ status: 409, description: 'Item already saved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createSavedItem(@Request() req: any, @Body() createSavedItemDto: CreateSavedItemDto) {
    return this.savedItemsService.createSavedItem(req.user.id, createSavedItemDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all saved items for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Saved items retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSavedItems(@Request() req: any, @Query() query: GetSavedItemsQueryDto) {
    return this.savedItemsService.getSavedItems(req.user.id, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get saved items statistics for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSavedItemsStats(@Request() req: any) {
    return this.savedItemsService.getSavedItemsCount(req.user.id);
  }

  @Get('check/:itemSaved')
  @ApiOperation({ summary: 'Check if an item is saved by the authenticated user' })
  @ApiParam({ name: 'itemSaved', description: 'Item identifier to check' })
  @ApiResponse({ status: 200, description: 'Check result returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkItemSaved(@Request() req: any, @Param('itemSaved') itemSaved: string) {
    const isSaved = await this.savedItemsService.isItemSaved(req.user.id, itemSaved);
    return { itemSaved, isSaved };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific saved item by ID' })
  @ApiParam({ name: 'id', description: 'Saved item ID' })
  @ApiResponse({ status: 200, description: 'Saved item retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Saved item not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSavedItemById(@Request() req: any, @Param('id') id: string) {
    return this.savedItemsService.getSavedItemById(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a saved item by ID' })
  @ApiParam({ name: 'id', description: 'Saved item ID to delete' })
  @ApiResponse({ status: 200, description: 'Saved item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Saved item not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteSavedItem(@Request() req: any, @Param('id') id: string) {
    return this.savedItemsService.deleteSavedItem(req.user.id, id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete all saved items for the authenticated user' })
  @ApiResponse({ status: 200, description: 'All saved items deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAllSavedItems(@Request() req: any) {
    return this.savedItemsService.deleteAllSavedItems(req.user.id);
  }
}
